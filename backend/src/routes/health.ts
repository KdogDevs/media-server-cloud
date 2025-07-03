import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

const router = Router();

// Health check endpoint
router.get('/', async (req: any, res) => {
    try {
        const healthCheck = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV,
            version: '1.0.0',
            services: {
                database: 'unknown',
                redis: 'unknown',
            }
        };

        // Check database connection
        try {
            await req.prisma.$queryRaw`SELECT 1`;
            healthCheck.services.database = 'ok';
        } catch (error) {
            healthCheck.services.database = 'error';
            healthCheck.status = 'degraded';
        }

        // Check Redis connection
        try {
            await req.redis.ping();
            healthCheck.services.redis = 'ok';
        } catch (error) {
            healthCheck.services.redis = 'error';
            healthCheck.status = 'degraded';
        }

        const statusCode = healthCheck.status === 'ok' ? 200 : 503;
        res.status(statusCode).json(healthCheck);
    } catch (error) {
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
});

// Detailed health check
router.get('/detailed', async (req: any, res) => {
    try {
        const detailed = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV,
            version: '1.0.0',
            system: {
                memory: {
                    used: process.memoryUsage().heapUsed,
                    total: process.memoryUsage().heapTotal,
                    external: process.memoryUsage().external,
                    rss: process.memoryUsage().rss
                },
                cpu: process.cpuUsage(),
                platform: process.platform,
                nodeVersion: process.version
            },
            services: {
                database: { status: 'unknown', responseTime: 0 },
                redis: { status: 'unknown', responseTime: 0 },
            }
        };

        // Check database with timing
        try {
            const dbStart = Date.now();
            await req.prisma.$queryRaw`SELECT 1`;
            detailed.services.database = {
                status: 'ok',
                responseTime: Date.now() - dbStart
            };
        } catch (error: any) {
            detailed.services.database = {
                status: 'error',
                responseTime: 0,
                error: error.message
            } as any;
            detailed.status = 'degraded';
        }

        // Check Redis with timing
        try {
            const redisStart = Date.now();
            await req.redis.ping();
            detailed.services.redis = {
                status: 'ok',
                responseTime: Date.now() - redisStart
            };
        } catch (error: any) {
            detailed.services.redis = {
                status: 'error',
                responseTime: 0,
                error: error.message
            } as any;
            detailed.status = 'degraded';
        }

        const statusCode = detailed.status === 'ok' ? 200 : 503;
        res.status(statusCode).json(detailed);
    } catch (error) {
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Detailed health check failed'
        });
    }
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req: any, res) => {
    try {
        // Check if all critical services are ready
        await req.prisma.$queryRaw`SELECT 1`;
        await req.redis.ping();
        
        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(503).json({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

export default router;