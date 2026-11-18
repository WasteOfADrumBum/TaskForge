import { Router } from 'express';
import {
  forgotPassword,
  login,
  logout,
  register,
  resetPassword,
} from '../../controllers/authController';
import { createAuthRateLimiters } from '../../middleware/authRateLimit';

const router = Router();
const limits = createAuthRateLimiters();

router.post('/register', ...limits.register, register);
router.post('/login', ...limits.login, login);
router.post('/logout', logout);
router.post('/forgot-password', ...limits.forgotPassword, forgotPassword);
router.post('/reset-password', ...limits.resetPassword, resetPassword);

export default router;
