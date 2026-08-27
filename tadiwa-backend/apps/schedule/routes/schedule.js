import { Router } from "express";
import { scheduleController } from "../controller/schedule.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";
import { requireRole } from "../../../middleware/requireRole.js";

const router = Router();

router.use(authMiddleware);

// GET /api/schedule — own schedule by default; ?userId= for TEAM_LEAD/ADMIN
// viewing someone else's (enforced in the controller, not just here).
router.get("/", scheduleController.list);

// GET /api/schedule/peers — who else is on shift that day.
router.get("/peers", scheduleController.peers);

// POST /api/schedule/blocks — TEAM_LEAD/ADMIN only.
router.post("/blocks", requireRole("TEAM_LEAD", "ADMIN"), scheduleController.create);

// PUT /api/schedule/blocks/:id — TEAM_LEAD/ADMIN only.
router.put("/blocks/:id", requireRole("TEAM_LEAD", "ADMIN"), scheduleController.update);

// DELETE /api/schedule/blocks/:id — TEAM_LEAD/ADMIN only.
router.delete("/blocks/:id", requireRole("TEAM_LEAD", "ADMIN"), scheduleController.remove);

export default router;
