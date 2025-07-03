import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

// Import type augmentations
import './types/express';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import containerRoutes from './routes/containers';
import billingRoutes from './routes/billing';
import adminRoutes from './routes/admin';
import healthRoutes from './routes/health';

// Import middleware
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { clerkAuth } from './middleware/clerk-auth';

// Import services
import { logger } from './utils/logger';
import { validateEnv } from './utils/validate-env';

const app = express();
const port = process.env.PORT || 3000;

// Validate environment variables
validateEnv();

// Initialize database and Redis
const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });

// Connect to Redis
redis.connect().catch((err) => {
    logger.error('Redis connection failed:', err);
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "https://clerk.dev"],
            "connect-src": ["'self'", "https://api.clerk.dev", "https://clerk.dev"],
            "img-src": ["'self'", "data:", "https:"],
        },
    },
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? [`https://app.${process.env.DOMAIN}`, `https://${process.env.DOMAIN}`]
        : ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

// Webhook rate limiting (more restrictive)
const webhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many webhook requests, please try again later.',
});

app.use('/webhooks/', webhookLimiter);

// Make Prisma and Redis available to routes
app.use((req: any, res, next) => {
    req.prisma = prisma;
    req.redis = redis;
    next();
});

// Health check routes (no auth required)
app.use('/healthz', healthRoutes);
app.use('/metrics', healthRoutes);

// Public webhook routes (no auth required)
import webhookRoutes from './routes/webhooks';
app.use('/webhooks', webhookRoutes);

// API routes (require authentication)
app.use('/users', clerkAuth, userRoutes);
app.use('/containers', clerkAuth, containerRoutes);
app.use('/billing', clerkAuth, billingRoutes);
app.use('/admin', clerkAuth, adminRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({
        name: 'Media Platform API',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
    logger.info('Received shutdown signal, closing server gracefully...');
    
    try {
        await prisma.$disconnect();
        await redis.quit();
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const server = app.listen(port, () => {
    logger.info(`🚀 Media Platform API server running on port ${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`Health check: http://localhost:${port}/healthz`);
});

// Handle server errors
server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.syscall !== 'listen') {
        throw error;
    }

    switch (error.code) {
        case 'EACCES':
            logger.error(`Port ${port} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            logger.error(`Port ${port} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});

export default app;