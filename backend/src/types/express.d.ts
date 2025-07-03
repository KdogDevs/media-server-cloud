declare global {
  namespace Express {
    interface Request {
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
  }
}