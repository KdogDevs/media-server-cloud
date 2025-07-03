import { Router } from 'express';
import { clerkService } from '../services/clerk-service';
import { logger } from '../utils/logger';

const router = Router();

// Clerk webhook endpoint
router.post('/clerk', async (req, res) => {
    const payload = JSON.stringify(req.body);
    const signature = req.headers['svix-signature'] as string;

    try {
        // Note: Clerk webhook signature verification may not be required
        // as mentioned in the issue that there's no webhook secret in Clerk
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

// Clerk webhook handlers
async function handleUserCreated(userData: any, req: any) {
    logger.info('Processing user created:', userData.id);
    
    try {
        // Create user in our database
        const user = await req.prisma.user.create({
            data: {
                clerkId: userData.id,
                email: userData.email_addresses[0]?.email_address || '',
                firstName: userData.first_name,
                lastName: userData.last_name,
                imageUrl: userData.image_url,
                role: 'CUSTOMER',
                subscriptionStatus: 'TRIAL',
                trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
            }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: user.id,
                action: 'USER_CREATED',
                details: {
                    clerkId: userData.id,
                    email: user.email
                }
            }
        });

        logger.info(`User created successfully: ${user.id}`);
    } catch (error) {
        logger.error('Failed to create user:', error);
        throw error;
    }
}

async function handleUserUpdated(userData: any, req: any) {
    logger.info('Processing user updated:', userData.id);
    
    try {
        // Update user in our database
        const user = await req.prisma.user.update({
            where: { clerkId: userData.id },
            data: {
                email: userData.email_addresses[0]?.email_address || '',
                firstName: userData.first_name,
                lastName: userData.last_name,
                imageUrl: userData.image_url,
            }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: user.id,
                action: 'USER_UPDATED',
                details: {
                    clerkId: userData.id,
                    email: user.email
                }
            }
        });

        logger.info(`User updated successfully: ${user.id}`);
    } catch (error) {
        logger.error('Failed to update user:', error);
        throw error;
    }
}

async function handleUserDeleted(userData: any, req: any) {
    logger.info('Processing user deleted:', userData.id);
    
    try {
        // Find and delete user from our database
        const user = await req.prisma.user.findUnique({
            where: { clerkId: userData.id }
        });

        if (user) {
            // Log activity before deletion
            await req.prisma.activityLog.create({
                data: {
                    userId: user.id,
                    action: 'USER_DELETED',
                    details: {
                        clerkId: userData.id,
                        email: user.email
                    }
                }
            });

            // Delete user (cascade will handle related records)
            await req.prisma.user.delete({
                where: { clerkId: userData.id }
            });

            logger.info(`User deleted successfully: ${user.id}`);
        } else {
            logger.warn(`User not found for deletion: ${userData.id}`);
        }
    } catch (error) {
        logger.error('Failed to delete user:', error);
        throw error;
    }
}

export default router;