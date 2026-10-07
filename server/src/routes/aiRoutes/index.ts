import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getProviderStatus } from '../../ai/provider';

const router = Router();
router.use(requireAuth);
// Capability metadata only. Execution waits for run permissions and approval tickets.
router.get('/status', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getProviderStatus());
});
export default router;
