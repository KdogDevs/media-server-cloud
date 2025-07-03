import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/clerk-auth';
import { logger } from '../utils/logger';

const router = Router();

// Get billing information
router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
        const user = await req.prisma.user.findUnique({
            where: { id: req.user!.id },
            include: {
                subscriptions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                billingHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            subscriptionStatus: user.subscriptionStatus,
            trialEndsAt: user.trialEndsAt,
            subscriptionEndsAt: user.subscriptionEndsAt,
            activeSubscription: user.subscriptions[0] || null,
            billingHistory: user.billingHistory.map(record => ({
                id: record.id,
                amount: record.amount,
                currency: record.currency,
                status: record.status,
                description: record.description,
                createdAt: record.createdAt
            }))
        });
    } catch (error) {
        logger.error('Failed to get billing information:', error);
        res.status(500).json({ error: 'Failed to get billing information' });
    }
});

// Note: Subscription management will be handled through Clerk's billing components
// These endpoints are kept for backward compatibility and future Clerk integration
router.post('/subscribe', async (req: AuthenticatedRequest, res) => {
    res.status(501).json({ 
        error: 'Subscription management is now handled through Clerk billing components',
        redirectTo: '/dashboard/billing'
    });
});

router.post('/cancel', async (req: AuthenticatedRequest, res) => {
    res.status(501).json({ 
        error: 'Subscription management is now handled through Clerk billing components',
        redirectTo: '/dashboard/billing'
    });
});

router.post('/resume', async (req: AuthenticatedRequest, res) => {
    res.status(501).json({ 
        error: 'Subscription management is now handled through Clerk billing components',
        redirectTo: '/dashboard/billing'
    });
});

router.get('/invoices', async (req: AuthenticatedRequest, res) => {
    try {
        const user = await req.prisma.user.findUnique({
            where: { id: req.user!.id },
            include: {
                billingHistory: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            invoices: user.billingHistory.map(record => ({
                id: record.id,
                amount: record.amount,
                currency: record.currency,
                status: record.status,
                description: record.description,
                createdAt: record.createdAt
            }))
        });
    } catch (error) {
        logger.error('Failed to get invoices:', error);
        res.status(500).json({ error: 'Failed to get invoices' });
    }
});

export default router;