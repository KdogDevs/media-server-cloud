import { Router } from 'express';
import Stripe from 'stripe';
import { AuthenticatedRequest } from '../middleware/clerk-auth';
import { logger } from '../utils/logger';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
});

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

        let stripeCustomer = null;
        let paymentMethods = [];

        if (user.stripeCustomerId) {
            try {
                stripeCustomer = await stripe.customers.retrieve(user.stripeCustomerId);
                
                const paymentMethodsResponse = await stripe.paymentMethods.list({
                    customer: user.stripeCustomerId,
                    type: 'card',
                });
                paymentMethods = paymentMethodsResponse.data;
            } catch (stripeError) {
                logger.error('Failed to fetch Stripe data:', stripeError);
            }
        }

        res.json({
            subscriptionStatus: user.subscriptionStatus,
            trialEndsAt: user.trialEndsAt,
            subscriptionEndsAt: user.subscriptionEndsAt,
            activeSubscription: user.subscriptions[0] || null,
            billingHistory: user.billingHistory,
            paymentMethods: paymentMethods.map(pm => ({
                id: pm.id,
                brand: pm.card?.brand,
                last4: pm.card?.last4,
                expMonth: pm.card?.exp_month,
                expYear: pm.card?.exp_year,
            })),
            stripeCustomer: stripeCustomer ? {
                id: stripeCustomer.id,
                email: stripeCustomer.email,
                name: stripeCustomer.name,
            } : null
        });
    } catch (error) {
        logger.error('Failed to get billing information:', error);
        res.status(500).json({ error: 'Failed to get billing information' });
    }
});

// Create subscription
router.post('/subscribe', async (req: AuthenticatedRequest, res) => {
    try {
        const { paymentMethodId } = req.body;

        if (!paymentMethodId) {
            return res.status(400).json({ error: 'Payment method required' });
        }

        const user = await req.prisma.user.findUnique({
            where: { id: req.user!.id }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user already has active subscription
        if (user.subscriptionStatus === 'ACTIVE') {
            return res.status(409).json({ error: 'User already has active subscription' });
        }

        let customerId = user.stripeCustomerId;

        // Create Stripe customer if doesn't exist
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: `${user.firstName} ${user.lastName}`.trim(),
                metadata: {
                    userId: user.id,
                    clerkId: user.clerkId
                }
            });
            customerId = customer.id;

            // Update user with Stripe customer ID
            await req.prisma.user.update({
                where: { id: user.id },
                data: { stripeCustomerId: customerId }
            });
        }

        // Attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
        });

        // Set as default payment method
        await stripe.customers.update(customerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: process.env.STRIPE_PRICE_ID }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
        });

        // Update user subscription status
        await req.prisma.user.update({
            where: { id: user.id },
            data: {
                stripeSubscriptionId: subscription.id,
                subscriptionStatus: 'ACTIVE',
                subscriptionEndsAt: new Date(subscription.current_period_end * 1000)
            }
        });

        // Create subscription record
        await req.prisma.subscription.create({
            data: {
                userId: user.id,
                stripeSubscriptionId: subscription.id,
                stripePriceId: process.env.STRIPE_PRICE_ID!,
                status: 'ACTIVE',
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000)
            }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: user.id,
                action: 'SUBSCRIPTION_CREATED',
                details: {
                    subscriptionId: subscription.id,
                    priceId: process.env.STRIPE_PRICE_ID
                }
            }
        });

        res.json({
            subscriptionId: subscription.id,
            clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
            status: subscription.status
        });
    } catch (error) {
        logger.error('Failed to create subscription:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

// Cancel subscription
router.post('/cancel', async (req: AuthenticatedRequest, res) => {
    try {
        const user = await req.prisma.user.findUnique({
            where: { id: req.user!.id }
        });

        if (!user || !user.stripeSubscriptionId) {
            return res.status(404).json({ error: 'No active subscription found' });
        }

        // Cancel subscription at period end
        const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: true
        });

        // Update subscription record
        await req.prisma.subscription.updateMany({
            where: { 
                userId: user.id,
                stripeSubscriptionId: user.stripeSubscriptionId 
            },
            data: { cancelAtPeriodEnd: true }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: user.id,
                action: 'SUBSCRIPTION_CANCELLED',
                details: {
                    subscriptionId: subscription.id,
                    cancelAtPeriodEnd: true
                }
            }
        });

        res.json({
            success: true,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        });
    } catch (error) {
        logger.error('Failed to cancel subscription:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

// Resume subscription
router.post('/resume', async (req: AuthenticatedRequest, res) => {
    try {
        const user = await req.prisma.user.findUnique({
            where: { id: req.user!.id }
        });

        if (!user || !user.stripeSubscriptionId) {
            return res.status(404).json({ error: 'No subscription found' });
        }

        // Resume subscription
        const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: false
        });

        // Update subscription record
        await req.prisma.subscription.updateMany({
            where: { 
                userId: user.id,
                stripeSubscriptionId: user.stripeSubscriptionId 
            },
            data: { cancelAtPeriodEnd: false }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: user.id,
                action: 'SUBSCRIPTION_RESUMED',
                details: {
                    subscriptionId: subscription.id
                }
            }
        });

        res.json({
            success: true,
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        });
    } catch (error) {
        logger.error('Failed to resume subscription:', error);
        res.status(500).json({ error: 'Failed to resume subscription' });
    }
});

// Get invoices
router.get('/invoices', async (req: AuthenticatedRequest, res) => {
    try {
        const user = await req.prisma.user.findUnique({
            where: { id: req.user!.id }
        });

        if (!user || !user.stripeCustomerId) {
            return res.json({ invoices: [] });
        }

        const invoices = await stripe.invoices.list({
            customer: user.stripeCustomerId,
            limit: 20
        });

        const formattedInvoices = invoices.data.map(invoice => ({
            id: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: invoice.status,
            paid: invoice.paid,
            created: new Date(invoice.created * 1000),
            dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
            invoiceUrl: invoice.hosted_invoice_url,
            invoicePdf: invoice.invoice_pdf
        }));

        res.json({ invoices: formattedInvoices });
    } catch (error) {
        logger.error('Failed to get invoices:', error);
        res.status(500).json({ error: 'Failed to get invoices' });
    }
});

export default router;