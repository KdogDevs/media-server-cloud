import { Router } from 'express';
import { AuthenticatedRequest, requireAdmin } from '../middleware/clerk-auth';
import { dockerService } from '../services/docker-service';
import { hetznerService } from '../services/hetzner-service';
import { logger } from '../utils/logger';

const router = Router();

// All admin routes require admin role
router.use(requireAdmin);

// Get dashboard stats
router.get('/dashboard', async (req: AuthenticatedRequest, res) => {
    try {
        const [
            totalUsers,
            activeSubscriptions,
            totalContainers,
            runningContainers,
            totalRevenue,
            recentUsers
        ] = await Promise.all([
            req.prisma.user.count(),
            req.prisma.user.count({ where: { subscriptionStatus: 'ACTIVE' } }),
            req.prisma.container.count(),
            req.prisma.container.count({ where: { status: 'RUNNING' } }),
            req.prisma.billingRecord.aggregate({
                where: { status: 'PAID' },
                _sum: { amount: true }
            }),
            req.prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    containers: true,
                    subscriptions: {
                        where: { status: 'ACTIVE' },
                        take: 1
                    }
                }
            })
        ]);

        // Get Docker container stats
        const dockerContainers = await dockerService.listMediaPlatformContainers();

        res.json({
            stats: {
                totalUsers,
                activeSubscriptions,
                totalContainers,
                runningContainers,
                totalRevenue: totalRevenue._sum.amount || 0,
                dockerContainers: dockerContainers.length
            },
            recentUsers: recentUsers.map(user => ({
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                subscriptionStatus: user.subscriptionStatus,
                containerCount: user.containers.length,
                hasActiveSubscription: user.subscriptions.length > 0,
                createdAt: user.createdAt
            })),
            systemHealth: {
                dockerContainers: dockerContainers.map(container => ({
                    name: container.name,
                    status: container.status,
                    state: container.state,
                    mediaType: container.mediaType,
                    userId: container.userId
                }))
            }
        });
    } catch (error) {
        logger.error('Failed to get admin dashboard:', error);
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

// Get all users with pagination
router.get('/users', async (req: AuthenticatedRequest, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [users, total] = await Promise.all([
            req.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    containers: true,
                    subscriptions: {
                        where: { status: 'ACTIVE' },
                        take: 1
                    },
                    billingHistory: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                }
            }),
            req.prisma.user.count({ where })
        ]);

        const formattedUsers = users.map(user => ({
            id: user.id,
            clerkId: user.clerkId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            subscriptionStatus: user.subscriptionStatus,
            trialEndsAt: user.trialEndsAt,
            subscriptionEndsAt: user.subscriptionEndsAt,
            containerCount: user.containers.length,
            storageUsedGB: user.storageUsedGB,
            storageQuotaGB: user.storageQuotaGB,
            hasActiveSubscription: user.subscriptions.length > 0,
            lastBilling: user.billingHistory[0] || null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }));

        res.json({
            users: formattedUsers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Failed to get users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get specific user details
router.get('/users/:id', async (req: AuthenticatedRequest, res) => {
    try {
        const user = await req.prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                containers: true,
                subscriptions: {
                    orderBy: { createdAt: 'desc' }
                },
                billingHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: 20
                },
                activityLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get storage usage for each container
        const containersWithStorage = await Promise.all(
            user.containers.map(async (container) => {
                const storageUsage = await hetznerService.getStorageUsage(user.id);
                const dockerStatus = await dockerService.getContainerStatus(container.containerName);
                
                return {
                    ...container,
                    storageUsage,
                    dockerStatus
                };
            })
        );

        res.json({
            ...user,
            containers: containersWithStorage
        });
    } catch (error) {
        logger.error('Failed to get user details:', error);
        res.status(500).json({ error: 'Failed to get user details' });
    }
});

// Update user role
router.patch('/users/:id/role', async (req: AuthenticatedRequest, res) => {
    try {
        const { role } = req.body;
        
        if (!['CUSTOMER', 'SUPPORT', 'ADMIN'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await req.prisma.user.update({
            where: { id: req.params.id },
            data: { role }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user!.id,
                action: 'USER_ROLE_UPDATED',
                resource: user.id,
                details: {
                    newRole: role,
                    updatedBy: req.user!.id
                }
            }
        });

        res.json({ success: true, user: { id: user.id, role: user.role } });
    } catch (error) {
        logger.error('Failed to update user role:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

// Suspend user
router.post('/users/:id/suspend', async (req: AuthenticatedRequest, res) => {
    try {
        const user = await req.prisma.user.findUnique({
            where: { id: req.params.id },
            include: { containers: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Stop all user containers
        for (const container of user.containers) {
            try {
                await dockerService.stopContainer(container.containerName);
                await req.prisma.container.update({
                    where: { id: container.id },
                    data: { status: 'SUSPENDED' }
                });
            } catch (containerError) {
                logger.error(`Failed to stop container ${container.containerName}:`, containerError);
            }
        }

        // Update user status
        await req.prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: 'CANCELED' }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user!.id,
                action: 'USER_SUSPENDED',
                resource: user.id,
                details: {
                    suspendedBy: req.user!.id,
                    reason: req.body.reason || 'Administrative action'
                }
            }
        });

        res.json({ success: true, message: 'User suspended successfully' });
    } catch (error) {
        logger.error('Failed to suspend user:', error);
        res.status(500).json({ error: 'Failed to suspend user' });
    }
});

// Get all containers
router.get('/containers', async (req: AuthenticatedRequest, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [containers, total] = await Promise.all([
            req.prisma.container.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            subscriptionStatus: true
                        }
                    }
                }
            }),
            req.prisma.container.count()
        ]);

        // Get Docker status for each container
        const containersWithStatus = await Promise.all(
            containers.map(async (container) => {
                const dockerStatus = await dockerService.getContainerStatus(container.containerName);
                return {
                    ...container,
                    dockerStatus
                };
            })
        );

        res.json({
            containers: containersWithStatus,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Failed to get containers:', error);
        res.status(500).json({ error: 'Failed to get containers' });
    }
});

// Force restart container
router.post('/containers/:id/restart', async (req: AuthenticatedRequest, res) => {
    try {
        const container = await req.prisma.container.findUnique({
            where: { id: req.params.id },
            include: { user: true }
        });

        if (!container) {
            return res.status(404).json({ error: 'Container not found' });
        }

        // Stop and start container
        await dockerService.stopContainer(container.containerName);
        await dockerService.startContainer(container.containerName);

        await req.prisma.container.update({
            where: { id: container.id },
            data: {
                status: 'RUNNING',
                lastHealthCheck: new Date()
            }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user!.id,
                action: 'CONTAINER_RESTARTED_ADMIN',
                resource: container.containerName,
                details: {
                    containerOwner: container.userId,
                    restartedBy: req.user!.id
                }
            }
        });

        res.json({ success: true, message: 'Container restarted successfully' });
    } catch (error) {
        logger.error('Failed to restart container:', error);
        res.status(500).json({ error: 'Failed to restart container' });
    }
});

// Get system logs
router.get('/logs', async (req: AuthenticatedRequest, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const action = req.query.action as string;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (action) {
            where.action = action;
        }

        const [logs, total] = await Promise.all([
            req.prisma.activityLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            }),
            req.prisma.activityLog.count({ where })
        ]);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Failed to get system logs:', error);
        res.status(500).json({ error: 'Failed to get system logs' });
    }
});

export default router;