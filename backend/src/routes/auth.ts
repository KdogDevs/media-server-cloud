import { Router } from 'express';

const router = Router();

// Authentication routes are handled by Clerk
// These routes are placeholders for any additional auth logic

// Check authentication status
router.get('/status', (req: any, res) => {
    res.json({
        authenticated: !!req.user,
        user: req.user || null,
        timestamp: new Date().toISOString()
    });
});

// Logout (handled by frontend Clerk)
router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logout should be handled by the frontend Clerk client'
    });
});

export default router;