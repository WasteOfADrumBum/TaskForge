import { Router } from 'express';
import {
  createJobHandler,
  createSkillHandler,
  deleteJobHandler,
  deleteSkillHandler,
  listJobs,
  listSkills,
  updateJobHandler,
  updateSkillHandler,
} from '../../controllers/careerController';
import { requireAuth } from '../../middleware/auth';

export const skillRoutes = Router();
skillRoutes.use(requireAuth);
skillRoutes.get('/', listSkills);
skillRoutes.post('/', createSkillHandler);
skillRoutes.patch('/:id', updateSkillHandler);
skillRoutes.delete('/:id', deleteSkillHandler);

export const jobRoutes = Router();
jobRoutes.use(requireAuth);
jobRoutes.get('/', listJobs);
jobRoutes.post('/', createJobHandler);
jobRoutes.patch('/:id', updateJobHandler);
jobRoutes.delete('/:id', deleteJobHandler);
