// server/src/routes/authRoutes/index.ts
import { Router } from "express";
import { register, login } from "../../controllers/authController";
import { RequestHandler } from "express"; 

const router = Router();

// Explicitly type the handlers as RequestHandler
router.post("/register", register as RequestHandler);
router.post("/login", login as RequestHandler);

export default router;
