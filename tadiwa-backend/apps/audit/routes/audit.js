import { Router } from "express";
import { auditController } from "../controller/audit.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";
import { requireRole } from "../../../middleware/requireRole.js";

const router = Router();

router.use(authMiddleware);
router.use(requireRole("TEAM_LEAD", "ADMIN"));

// GET /api/audit — Chrome extension (chatbot) usage log
router.get("/", auditController.list);

export default router;
