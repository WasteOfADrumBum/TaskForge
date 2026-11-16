import { Router } from 'express';
import {
  createLearningHandler,
  deleteLearningHandler,
  listLearning,
  updateLearningHandler,
} from '../../controllers/learningController';
import { requireAuth } from '../../middleware/auth';

const learningRoutes = Router();
learningRoutes.use(requireAuth);
learningRoutes.get('/', listLearning);
learningRoutes.post('/', createLearningHandler);
learningRoutes.patch('/:id', updateLearningHandler);
learningRoutes.delete('/:id', deleteLearningHandler);

export default learningRoutes;
