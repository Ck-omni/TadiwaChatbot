import { Router } from "express";
import { productivityController } from "../controller/productivity.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";
import { requireRole } from "../../../middleware/requireRole.js";

const router = Router();

router.use(authMiddleware);

// GET /api/productivity — any authenticated user; scope is enforced in the
// service (self only for AGENT, everyone for TEAM_LEAD/ADMIN).
router.get("/", productivityController.list);

// POST /api/productivity/targets — TEAM_LEAD/ADMIN only.
router.post("/targets", requireRole("TEAM_LEAD", "ADMIN"), productivityController.setTarget);

export default router;
