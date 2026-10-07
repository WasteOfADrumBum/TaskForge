import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import {
  createRunHandler,
  cancelRunHandler,
  runAuditHandler,
  denialAuditHandler,
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
router.get('/audit/denials', denialAuditHandler);
router.get('/:id', getRunHandler);
router.get('/:id/audit', runAuditHandler);
router.post('/:id/execute', executeRunGuard);
router.post('/:id/cancel', cancelRunHandler);
export default router;
