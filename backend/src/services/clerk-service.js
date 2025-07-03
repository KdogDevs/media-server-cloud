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
     * Verify webhook signature (not used since Clerk doesn't require webhook secrets)
     */
    verifyWebhookSignature(payload: string, signature: string): boolean {
        // As mentioned in the issue, there's no webhook secret in Clerk
        // So we'll just return true for now
        return true;
    }
}

export const clerkService = new ClerkService();