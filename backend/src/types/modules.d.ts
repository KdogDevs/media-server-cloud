// Type declarations for JS modules that don't have .d.ts files

declare module '../middleware/clerk-auth' {
  import { Request, Response, NextFunction } from 'express';
  
  export interface AuthenticatedRequest extends Request {
    user?: {
      id: string;
      clerkId: string;
      email: string;
      role: string;
      firstName?: string;
      lastName?: string;
    };
    prisma: any;
    redis: any;
  }
  
  export function clerkAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
  export function requireSupport(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
}

declare module '../services/clerk-service' {
  export class ClerkService {
    getUser(clerkId: string): Promise<any>;
    updateUserMetadata(clerkId: string, metadata: any): Promise<any>;
    deleteUser(clerkId: string): Promise<any>;
    sendEmail(clerkId: string, emailData: { subject: string; body: string; fromEmailName?: string }): Promise<boolean>;
    verifyWebhookSignature(payload: string, signature: string): boolean;
  }
  
  export const clerkService: ClerkService;
}

declare module '../services/docker-service' {
  export const dockerService: any;
}

declare module '../services/hetzner-service' {
  export const hetznerService: any;
}