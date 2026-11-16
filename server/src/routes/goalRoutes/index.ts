import { Router } from 'express';
import {
  createGoalHandler,
  deleteGoalHandler,
  listGoals,
  updateGoalHandler,
} from '../../controllers/goalController';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/', listGoals);
router.post('/', createGoalHandler);
router.patch('/:id', updateGoalHandler);
router.delete('/:id', deleteGoalHandler);

export default router;
