import { Router } from 'express';
import { listReviews, saveReviewHandler } from '../../controllers/reviewController';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/', listReviews);
router.put('/:kind/:period', saveReviewHandler);

export default router;
