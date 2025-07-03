import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Log the error
    logger.error('Error occurred:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
    });

    // Default error
    let status = 500;
    let message = 'Internal Server Error';

    // Handle specific error types
    if (error.name === 'ValidationError') {
        status = 400;
        message = error.message;
    } else if (error.name === 'UnauthorizedError') {
        status = 401;
        message = 'Unauthorized';
    } else if (error.name === 'ForbiddenError') {
        status = 403;
        message = 'Forbidden';
    } else if (error.name === 'NotFoundError') {
        status = 404;
        message = 'Not Found';
    } else if (error.code === 'P2002') {
        // Prisma unique constraint error
        status = 409;
        message = 'Resource already exists';
    } else if (error.code === 'P2025') {
        // Prisma record not found
        status = 404;
        message = 'Resource not found';
    }

    // Don't expose stack traces in production
    const response: any = {
        error: true,
        message,
        timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV !== 'production') {
        response.stack = error.stack;
        response.details = error;
    }

    res.status(status).json(response);
};