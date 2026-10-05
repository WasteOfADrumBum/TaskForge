import { Router } from 'express';
import { login, logout, register } from '../../controllers/authController';
import { createAuthRateLimiters } from '../../middleware/authRateLimit';

const router = Router();
const limits = createAuthRateLimiters();

router.post('/register', ...limits.register, register);
router.post('/login', ...limits.login, login);
router.post('/logout', logout);

export default router;
