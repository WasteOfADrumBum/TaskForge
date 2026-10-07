import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import {
  createRunHandler,
  handoffRunHandler,
  handoffHistoryHandler,
  cancelRunHandler,
  runAuditHandler,
  denialAuditHandler,
  executeRunGuard,
  getRunHandler,
  listRunsHandler,
  pendingReviewsHandler,
  reviewRunHandler,
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
router.get('/approvals', pendingReviewsHandler);
router.get('/:id', getRunHandler);
router.get('/:id/handoffs', handoffHistoryHandler);
router.post('/:id/handoff', handoffRunHandler);
router.get('/:id/audit', runAuditHandler);
router.post('/:id/execute', executeRunGuard);
router.post('/:id/cancel', cancelRunHandler);
router.post('/:id/review', reviewRunHandler);
export default router;
