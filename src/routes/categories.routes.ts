import { Router } from "express";
import { getAllCategories } from "../controllers/categories.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", getAllCategories);

export default router;