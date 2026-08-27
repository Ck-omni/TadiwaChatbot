import {Router} from 'express';
import {authController} from '../controller/auth.js';
import {authMiddleware} from '../../../middleware/authMiddleware.js';

const router = Router();

// POST /api/v1/auth/login    — no auth required
router.post("/login", authController.login);
 
// POST /api/v1/auth/refresh  — no access token required; the refresh token
// in the body is the credential being checked here
router.post("/refresh", authController.refresh);
 
// POST /api/v1/auth/logout   — no access token required, same reasoning as refresh
router.post("/logout", authController.logout);
 
// GET  /api/v1/auth/me       — requires a valid access token
router.get("/me", authMiddleware, authController.me);
 
export default router;