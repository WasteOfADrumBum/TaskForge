import { Router } from 'express';
import {
  createAgentHandler,
  deleteAgentHandler,
  getAgentHandler,
  listAgents,
  updateAgentHandler,
} from '../../controllers/agentController';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/', listAgents);
router.post('/', createAgentHandler);
router.get('/:id', getAgentHandler);
router.patch('/:id', updateAgentHandler);
router.delete('/:id', deleteAgentHandler);

export default router;
