import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/clerk-auth';
import { dockerService } from '../services/docker-service';
import { hetznerService } from '../services/hetzner-service';
import { logger } from '../utils/logger';

const router = Router();

// Get user's containers
router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
        const containers = await req.prisma.container.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: 'desc' }
        });

        // Get real-time status for each container
        const containersWithStatus = await Promise.all(
            containers.map(async (container) => {
                let liveStatus = null;
                if (container.dockerContainerId) {
                    liveStatus = await dockerService.getContainerStatus(container.containerName);
                }

                return {
                    ...container,
                    liveStatus
                };
            })
        );

        res.json(containersWithStatus);
    } catch (error) {
        logger.error('Failed to get containers:', error);
        res.status(500).json({
            error: 'Failed to get containers'
        });
    }
});

// Create new container
router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
        const { mediaServerType, subdomainSlug } = req.body;

        // Validate input
        if (!mediaServerType || !subdomainSlug) {
            return res.status(400).json({
                error: 'Media server type and subdomain are required'
            });
        }

        if (!['JELLYFIN', 'PLEX', 'EMBY'].includes(mediaServerType)) {
            return res.status(400).json({
                error: 'Invalid media server type'
            });
        }

        // Check if user already has a container
        const existingContainer = await req.prisma.container.findFirst({
            where: { userId: req.user!.id }
        });

        if (existingContainer) {
            return res.status(409).json({
                error: 'User already has a container'
            });
        }

        // Check if subdomain is available
        const subdomainExists = await req.prisma.container.findFirst({
            where: { subdomainSlug }
        });

        if (subdomainExists) {
            return res.status(409).json({
                error: 'Subdomain already taken'
            });
        }

        const containerName = `media-${req.user!.id}-${subdomainSlug}`;

        // Create storage on Hetzner
        const storage = await hetznerService.createCustomerStorage(req.user!.id);

        // Mount storage locally
        const mount = await hetznerService.mountCustomerStorage(
            req.user!.id,
            storage.mountPath
        );

        // Create container in database first
        const container = await req.prisma.container.create({
            data: {
                userId: req.user!.id,
                containerName,
                mediaServerType,
                subdomainSlug,
                status: 'CREATING',
                hetznerStorageBox: storage.path,
                mountPath: mount.localPath,
                cpuLimit: 0.25,
                memoryLimit: 800,
                storageQuotaGB: 2048
            }
        });

        // Create Docker container
        try {
            const dockerResult = await dockerService.createMediaServerContainer({
                userId: req.user!.id,
                containerName,
                mediaServerType,
                subdomainSlug,
                storageMount: mount.localPath,
                cpuLimit: 0.25,
                memoryLimit: 800
            });

            // Update container with Docker info
            const updatedContainer = await req.prisma.container.update({
                where: { id: container.id },
                data: {
                    dockerContainerId: dockerResult.dockerContainerId,
                    externalPort: dockerResult.externalPort ? parseInt(dockerResult.externalPort) : null,
                    status: 'RUNNING',
                    lastHealthCheck: new Date()
                }
            });

            // Log activity
            await req.prisma.activityLog.create({
                data: {
                    userId: req.user!.id,
                    action: 'CONTAINER_CREATED',
                    resource: containerName,
                    details: {
                        mediaServerType,
                        subdomainSlug,
                        dockerContainerId: dockerResult.dockerContainerId
                    }
                }
            });

            res.status(201).json(updatedContainer);

        } catch (dockerError) {
            logger.error('Failed to create Docker container:', dockerError);
            
            // Update container status to error
            await req.prisma.container.update({
                where: { id: container.id },
                data: { status: 'ERROR' }
            });

            res.status(500).json({
                error: 'Failed to create container',
                details: dockerError.message
            });
        }

    } catch (error) {
        logger.error('Failed to create container:', error);
        res.status(500).json({
            error: 'Failed to create container'
        });
    }
});

// Get specific container
router.get('/:id', async (req: AuthenticatedRequest, res) => {
    try {
        const container = await req.prisma.container.findFirst({
            where: {
                id: req.params.id,
                userId: req.user!.id
            }
        });

        if (!container) {
            return res.status(404).json({
                error: 'Container not found'
            });
        }

        // Get live status
        let liveStatus = null;
        if (container.dockerContainerId) {
            liveStatus = await dockerService.getContainerStatus(container.containerName);
        }

        // Get storage usage
        const storageUsage = await hetznerService.getStorageUsage(req.user!.id);

        res.json({
            ...container,
            liveStatus,
            storageUsage
        });
    } catch (error) {
        logger.error('Failed to get container:', error);
        res.status(500).json({
            error: 'Failed to get container'
        });
    }
});

// Start container
router.post('/:id/start', async (req: AuthenticatedRequest, res) => {
    try {
        const container = await req.prisma.container.findFirst({
            where: {
                id: req.params.id,
                userId: req.user!.id
            }
        });

        if (!container) {
            return res.status(404).json({
                error: 'Container not found'
            });
        }

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
                action: 'CONTAINER_STARTED',
                resource: container.containerName
            }
        });

        res.json({ success: true, message: 'Container started' });
    } catch (error) {
        logger.error('Failed to start container:', error);
        res.status(500).json({
            error: 'Failed to start container'
        });
    }
});

// Stop container
router.post('/:id/stop', async (req: AuthenticatedRequest, res) => {
    try {
        const container = await req.prisma.container.findFirst({
            where: {
                id: req.params.id,
                userId: req.user!.id
            }
        });

        if (!container) {
            return res.status(404).json({
                error: 'Container not found'
            });
        }

        await dockerService.stopContainer(container.containerName);

        await req.prisma.container.update({
            where: { id: container.id },
            data: {
                status: 'STOPPED',
                lastHealthCheck: new Date()
            }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user!.id,
                action: 'CONTAINER_STOPPED',
                resource: container.containerName
            }
        });

        res.json({ success: true, message: 'Container stopped' });
    } catch (error) {
        logger.error('Failed to stop container:', error);
        res.status(500).json({
            error: 'Failed to stop container'
        });
    }
});

// Get container logs
router.get('/:id/logs', async (req: AuthenticatedRequest, res) => {
    try {
        const container = await req.prisma.container.findFirst({
            where: {
                id: req.params.id,
                userId: req.user!.id
            }
        });

        if (!container) {
            return res.status(404).json({
                error: 'Container not found'
            });
        }

        const tail = parseInt(req.query.tail as string) || 100;
        const logs = await dockerService.getContainerLogs(container.containerName, tail);

        res.json({
            containerName: container.containerName,
            logs
        });
    } catch (error) {
        logger.error('Failed to get container logs:', error);
        res.status(500).json({
            error: 'Failed to get container logs'
        });
    }
});

export default router;