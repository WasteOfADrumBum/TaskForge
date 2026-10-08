import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import {
  createKnowledgeHandler,
  listKnowledgeHandler,
  getKnowledgeHandler,
  searchKnowledgeHandler,
  updateKnowledgeHandler,
  deleteKnowledgeHandler,
  knowledgeAuditHandler,
  knowledgeDenialsHandler,
} from '../../controllers/knowledgeController';
const router = Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireAuth);
router.get('/', listKnowledgeHandler);
router.post('/', createKnowledgeHandler);
router.get('/search', searchKnowledgeHandler);
router.get('/audit/denials', knowledgeDenialsHandler);
router.get('/:id/audit', knowledgeAuditHandler);
router.get('/:id', getKnowledgeHandler);
router.put('/:id', updateKnowledgeHandler);
router.delete('/:id', deleteKnowledgeHandler);
export default router;
