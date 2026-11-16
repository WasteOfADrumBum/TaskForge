import { Router } from 'express';
import { listBrands, putBrand } from '../../controllers/brandController';
import { requireAuth } from '../../middleware/auth';

const brandRoutes = Router();
brandRoutes.use(requireAuth);
brandRoutes.get('/', listBrands);
brandRoutes.put('/:kind', putBrand);

export default brandRoutes;
