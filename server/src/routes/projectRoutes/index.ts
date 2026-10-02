import { Router } from 'express';
import {
  createProjectHandler,
  deleteProjectHandler,
  getProjectHandler,
  listProjects,
  updateProjectHandler,
} from '../../controllers/projectController';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/', listProjects);
router.post('/', createProjectHandler);
router.get('/:id', getProjectHandler);
router.patch('/:id', updateProjectHandler);
router.delete('/:id', deleteProjectHandler);

export default router;
