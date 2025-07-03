import { Router } from 'express';
import Stripe from 'stripe';
import { clerkService } from '../services/clerk-service';
import { logger } from '../utils/logger';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
});

// Stripe webhook endpoint
router.post('/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        logger.error('Stripe webhook signature verification failed:', err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    logger.info('Stripe webhook received:', { type: event.type, id: event.id });

    try {
        switch (event.type) {
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object as Stripe.Subscription, req);
                break;
            
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, req);
                break;
            
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, req);
                break;
            
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object as Stripe.Invoice, req);
                break;
            
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as Stripe.Invoice, req);
                break;
            
            case 'customer.created':
                await handleCustomerCreated(event.data.object as Stripe.Customer, req);
                break;
            
            default:
                logger.info(`Unhandled Stripe event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        logger.error('Error processing Stripe webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Clerk webhook endpoint
router.post('/clerk', async (req, res) => {
    const payload = JSON.stringify(req.body);
    const signature = req.headers['svix-signature'] as string;

    try {
        // Verify webhook signature
        const isValid = clerkService.verifyWebhookSignature(payload, signature);
        
        if (!isValid) {
            logger.error('Clerk webhook signature verification failed');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const { type, data } = req.body;
        logger.info('Clerk webhook received:', { type, userId: data.id });

        switch (type) {
            case 'user.created':
                await handleUserCreated(data, req);
                break;
            
            case 'user.updated':
                await handleUserUpdated(data, req);
                break;
            
            case 'user.deleted':
                await handleUserDeleted(data, req);
                break;
            
            default:
                logger.info(`Unhandled Clerk event type: ${type}`);
        }

        res.json({ received: true });
    } catch (error) {
        logger.error('Error processing Clerk webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Stripe webhook handlers
async function handleSubscriptionCreated(subscription: Stripe.Subscription, req: any) {
    logger.info('Processing subscription created:', subscription.id);
    
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    if (!customer || customer.deleted) {
        throw new Error('Customer not found');
    }

    // Find user by Stripe customer ID
    const user = await req.prisma.user.findFirst({
        where: { stripeCustomerId: customer.id }
    });

    if (!user) {
        throw new Error('User not found for customer');
    }

    // Update user subscription status
    await req.prisma.user.update({
        where: { id: user.id },
        data: {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: 'ACTIVE',
            subscriptionEndsAt: new Date(subscription.current_period_end * 1000)
        }
    });

    // Create or update subscription record
    await req.prisma.subscription.upsert({
        where: { stripeSubscriptionId: subscription.id },
        create: {
            userId: user.id,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0].price.id,
            status: 'ACTIVE',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
        },
        update: {
            status: 'ACTIVE',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        }
    });

    logger.info(`Subscription activated for user ${user.id}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, req: any) {
    logger.info('Processing subscription updated:', subscription.id);
    
    const user = await req.prisma.user.findFirst({
        where: { stripeSubscriptionId: subscription.id }
    });

    if (!user) {
        throw new Error('User not found for subscription');
    }

    const status = mapStripeStatusToPrisma(subscription.status);

    // Update user subscription status
    await req.prisma.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: status,
            subscriptionEndsAt: new Date(subscription.current_period_end * 1000)
        }
    });

    // Update subscription record
    await req.prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
            status: status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
        }
    });

    logger.info(`Subscription updated for user ${user.id}: ${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, req: any) {
    logger.info('Processing subscription deleted:', subscription.id);
    
    const user = await req.prisma.user.findFirst({
        where: { stripeSubscriptionId: subscription.id },
        include: { containers: true }
    });

    if (!user) {
        throw new Error('User not found for subscription');
    }

    // Update user subscription status
    await req.prisma.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'CANCELED',
            stripeSubscriptionId: null
        }
    });

    // Update subscription record
    await req.prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'CANCELED' }
    });

    // Suspend user containers
    for (const container of user.containers) {
        await req.prisma.container.update({
            where: { id: container.id },
            data: { status: 'SUSPENDED' }
        });
    }

    logger.info(`Subscription cancelled and containers suspended for user ${user.id}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice, req: any) {
    logger.info('Processing payment succeeded:', invoice.id);
    
    const customer = await stripe.customers.retrieve(invoice.customer as string);
    if (!customer || customer.deleted) {
        throw new Error('Customer not found');
    }

    const user = await req.prisma.user.findFirst({
        where: { stripeCustomerId: customer.id }
    });

    if (!user) {
        throw new Error('User not found for customer');
    }

    // Record successful payment
    await req.prisma.billingRecord.create({
        data: {
            userId: user.id,
            stripeInvoiceId: invoice.id,
            stripePaymentId: invoice.payment_intent as string,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: 'PAID',
            description: invoice.description || 'Subscription payment'
        }
    });

    logger.info(`Payment recorded for user ${user.id}: $${invoice.amount_paid / 100}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice, req: any) {
    logger.info('Processing payment failed:', invoice.id);
    
    const customer = await stripe.customers.retrieve(invoice.customer as string);
    if (!customer || customer.deleted) {
        throw new Error('Customer not found');
    }

    const user = await req.prisma.user.findFirst({
        where: { stripeCustomerId: customer.id }
    });

    if (!user) {
        throw new Error('User not found for customer');
    }

    // Record failed payment
    await req.prisma.billingRecord.create({
        data: {
            userId: user.id,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_due,
            currency: invoice.currency,
            status: 'FAILED',
            description: invoice.description || 'Subscription payment failed'
        }
    });

    // Update user status if payment failed
    await req.prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'PAST_DUE' }
    });

    logger.info(`Payment failed for user ${user.id}: $${invoice.amount_due / 100}`);
}

async function handleCustomerCreated(customer: Stripe.Customer, req: any) {
    logger.info('Processing customer created:', customer.id);
    // Customer creation is handled in the billing route
}

// Clerk webhook handlers
async function handleUserCreated(userData: any, req: any) {
    logger.info('Processing user created:', userData.id);
    
    // User creation is handled in the auth middleware
    // This webhook can be used for additional processing
}

async function handleUserUpdated(userData: any, req: any) {
    logger.info('Processing user updated:', userData.id);
    
    // Update user info in our database
    const user = await req.prisma.user.findFirst({
        where: { clerkId: userData.id }
    });

    if (user) {
        await req.prisma.user.update({
            where: { id: user.id },
            data: {
                email: userData.email_addresses[0]?.email_address,
                firstName: userData.first_name,
                lastName: userData.last_name,
                imageUrl: userData.image_url
            }
        });
    }
}

async function handleUserDeleted(userData: any, req: any) {
    logger.info('Processing user deleted:', userData.id);
    
    const user = await req.prisma.user.findFirst({
        where: { clerkId: userData.id },
        include: { containers: true }
    });

    if (user) {
        // Clean up user containers and data
        for (const container of user.containers) {
            try {
                // Stop and remove container
                const dockerService = require('../services/docker-service').dockerService;
                await dockerService.removeContainer(container.containerName);

                // Clean up storage
                const hetznerService = require('../services/hetzner-service').hetznerService;
                await hetznerService.deleteCustomerStorage(user.id);
            } catch (cleanupError) {
                logger.error(`Failed to cleanup container ${container.containerName}:`, cleanupError);
            }
        }

        // Cancel Stripe subscription if exists
        if (user.stripeSubscriptionId) {
            try {
                await stripe.subscriptions.cancel(user.stripeSubscriptionId);
            } catch (stripeError) {
                logger.error('Failed to cancel Stripe subscription:', stripeError);
            }
        }

        // Soft delete user (keep for audit trail)
        await req.prisma.user.update({
            where: { id: user.id },
            data: {
                email: `deleted_${Date.now()}@deleted.com`,
                firstName: 'Deleted',
                lastName: 'User',
                subscriptionStatus: 'CANCELED'
            }
        });

        logger.info(`User deleted and cleaned up: ${user.id}`);
    }
}

// Helper function to map Stripe status to Prisma enum
function mapStripeStatusToPrisma(stripeStatus: string): string {
    const statusMap: { [key: string]: string } = {
        'active': 'ACTIVE',
        'past_due': 'PAST_DUE',
        'canceled': 'CANCELED',
        'incomplete': 'UNPAID',
        'incomplete_expired': 'CANCELED',
        'trialing': 'TRIAL',
        'unpaid': 'UNPAID'
    };

    return statusMap[stripeStatus] || 'UNPAID';
}

export default router;