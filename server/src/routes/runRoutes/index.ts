import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import {
  createRunHandler,
  executeRunGuard,
  getRunHandler,
  listRunsHandler,
} from '../../controllers/runController';
const router = Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireAuth);
router.get('/', listRunsHandler);
router.post('/', createRunHandler);
router.get('/:id', getRunHandler);
router.post('/:id/execute', executeRunGuard);
export default router;
