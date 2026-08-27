import { Router } from "express";
import { dashboardController } from "../controller/dashboard.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";

const router = Router();

router.use(authMiddleware);

// GET /api/dashboard/summary — any authenticated user.
router.get("/summary", dashboardController.summary);

export default router;
