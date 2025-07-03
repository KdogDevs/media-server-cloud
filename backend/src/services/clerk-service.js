import { createClerkClient } from '@clerk/clerk-sdk-node';
import { logger } from '../utils/logger';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export class ClerkService {
    /**
     * Get user by Clerk ID
     */
    async getUser(clerkId: string) {
        try {
            return await clerk.users.getUser(clerkId);
        } catch (error) {
            logger.error('Failed to get user from Clerk:', error);
            throw error;
        }
    }

    /**
     * Update user metadata
     */
    async updateUserMetadata(clerkId: string, metadata: any) {
        try {
            return await clerk.users.updateUser(clerkId, {
                publicMetadata: metadata
            });
        } catch (error) {
            logger.error('Failed to update user metadata:', error);
            throw error;
        }
    }

    /**
     * Delete user
     */
    async deleteUser(clerkId: string) {
        try {
            return await clerk.users.deleteUser(clerkId);
        } catch (error) {
            logger.error('Failed to delete user:', error);
            throw error;
        }
    }

    /**
     * Send email to user
     */
    async sendEmail(clerkId: string, emailData: {
        subject: string;
        body: string;
        fromEmailName?: string;
    }) {
        try {
            // Note: This is a placeholder as Clerk doesn't have direct email sending
            // You would typically use a service like SendGrid, Mailgun, etc.
            logger.info(`Sending email to user ${clerkId}:`, emailData);
            return true;
        } catch (error) {
            logger.error('Failed to send email:', error);
            throw error;
        }
    }

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload: string, signature: string): boolean {
        try {
            // This is a simplified version - in production, you'd use the actual Clerk webhook verification
            const expectedSignature = process.env.CLERK_WEBHOOK_SECRET;
            return signature === expectedSignature;
        } catch (error) {
            logger.error('Failed to verify webhook signature:', error);
            return false;
        }
    }
}

export const clerkService = new ClerkService();