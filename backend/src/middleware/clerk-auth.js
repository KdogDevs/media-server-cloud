import { Request, Response, NextFunction } from 'express';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { logger } from '../utils/logger';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        clerkId: string;
        email: string;
        role: string;
        firstName?: string;
        lastName?: string;
    };
}

export const clerkAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No valid authorization token provided'
            });
        }

        const token = authHeader.substring(7);

        try {
            // Verify the token with Clerk
            const payload = await clerk.verifyToken(token);
            
            if (!payload || !payload.sub) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid token'
                });
            }

            // Get user details from Clerk
            const clerkUser = await clerk.users.getUser(payload.sub);
            
            if (!clerkUser) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'User not found'
                });
            }

            // Get or create user in our database
            let user = await req.prisma.user.findUnique({
                where: { clerkId: clerkUser.id }
            });

            if (!user) {
                // Create new user in our database
                user = await req.prisma.user.create({
                    data: {
                        clerkId: clerkUser.id,
                        email: clerkUser.emailAddresses[0]?.emailAddress || '',
                        firstName: clerkUser.firstName,
                        lastName: clerkUser.lastName,
                        imageUrl: clerkUser.imageUrl,
                        role: 'CUSTOMER', // Default role
                        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days trial
                    }
                });

                logger.info(`Created new user: ${user.id} (${user.email})`);
            } else {
                // Update user info if changed
                const updateData: any = {};
                if (clerkUser.firstName !== user.firstName) updateData.firstName = clerkUser.firstName;
                if (clerkUser.lastName !== user.lastName) updateData.lastName = clerkUser.lastName;
                if (clerkUser.imageUrl !== user.imageUrl) updateData.imageUrl = clerkUser.imageUrl;
                
                if (Object.keys(updateData).length > 0) {
                    user = await req.prisma.user.update({
                        where: { id: user.id },
                        data: updateData
                    });
                }
            }

            // Attach user to request
            req.user = {
                id: user.id,
                clerkId: user.clerkId,
                email: user.email,
                role: user.role,
                firstName: user.firstName || undefined,
                lastName: user.lastName || undefined,
            };

            next();
        } catch (clerkError) {
            logger.error('Clerk token verification failed:', clerkError);
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Token verification failed'
            });
        }
    } catch (error) {
        logger.error('Authentication middleware error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authentication failed'
        });
    }
};

// Middleware to check if user has admin role
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required'
        });
    }

    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required'
        });
    }

    next();
};

// Middleware to check if user has support role or higher
export const requireSupport = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required'
        });
    }

    if (!['ADMIN', 'SUPPORT'].includes(req.user.role)) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Support access required'
        });
    }

    next();
};