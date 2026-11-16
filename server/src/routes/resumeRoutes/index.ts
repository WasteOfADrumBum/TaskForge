import { Router } from 'express';
import { getResume, putResume } from '../../controllers/resumeController';
import { requireAuth } from '../../middleware/auth';

const resumeRoutes = Router();
resumeRoutes.use(requireAuth);
resumeRoutes.get('/', getResume);
resumeRoutes.put('/', putResume);

export default resumeRoutes;
