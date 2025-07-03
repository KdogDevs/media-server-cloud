import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/clerk-auth';
import { logger } from '../utils/logger';

const router = Router();

// Get current user profile
router.get('/profile', async (req: AuthenticatedRequest, res) => {
    try {
        const user = await req.prisma.user.findUnique({
            where: { id: req.user!.id },
            include: {
                containers: true,
                subscriptions: {
                    where: { status: 'ACTIVE' },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            role: user.role,
            subscriptionStatus: user.subscriptionStatus,
            trialEndsAt: user.trialEndsAt,
            containerCount: user.containers.length,
            storageUsedGB: user.storageUsedGB,
            storageQuotaGB: user.storageQuotaGB,
            activeSubscription: user.subscriptions[0] || null
        });
    } catch (error) {
        logger.error('Failed to get user profile:', error);
        res.status(500).json({
            error: 'Failed to get user profile'
        });
    }
});

// Update user profile
router.patch('/profile', async (req: AuthenticatedRequest, res) => {
    try {
        const { firstName, lastName } = req.body;

        const user = await req.prisma.user.update({
            where: { id: req.user!.id },
            data: {
                firstName,
                lastName,
                updatedAt: new Date()
            }
        });

        res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl
        });
    } catch (error) {
        logger.error('Failed to update user profile:', error);
        res.status(500).json({
            error: 'Failed to update user profile'
        });
    }
});

// Get user's activity logs
router.get('/activity', async (req: AuthenticatedRequest, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            req.prisma.activityLog.findMany({
                where: { userId: req.user!.id },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            req.prisma.activityLog.count({
                where: { userId: req.user!.id }
            })
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
        logger.error('Failed to get user activity:', error);
        res.status(500).json({
            error: 'Failed to get user activity'
        });
    }
});

export default router;