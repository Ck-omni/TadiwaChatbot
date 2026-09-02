import {Router} from "express";
import {copilotEscalationController} from "../controller/copilotEscalations.js";
import {authMiddleware} from "../../../middleware/authMiddleware.js";

// Unlike apps/escalations/routes/escalations.js (the TEAM_LEAD/ADMIN-only
// console view), any signed-in agent can call these — the Chrome extension
// uses them to raise and update escalations straight from the Suggested
// Resolution panel. Ownership is checked in the controller/service layer.
const router = Router();

router.use(authMiddleware);

// POST /api/copilot-escalations
router.post("/", copilotEscalationController.create);

// PUT /api/copilot-escalations/:id/status
router.put("/:id/status", copilotEscalationController.updateStatus);

export default router;
