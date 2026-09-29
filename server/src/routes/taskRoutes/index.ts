import { Router } from 'express';
import {
  createTaskHandler,
  deleteTaskHandler,
  listTasks,
  updateTaskHandler,
} from '../../controllers/taskController';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/', listTasks);
router.post('/', createTaskHandler);
router.patch('/:id', updateTaskHandler);
router.delete('/:id', deleteTaskHandler);

export default router;
