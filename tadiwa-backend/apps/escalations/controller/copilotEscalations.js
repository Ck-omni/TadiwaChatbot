import {escalationService} from "../service/escalations.js";
import {authService} from "../../auth/service/auth.js";
import {asyncHandler} from "../../../utils/asyncHandler.js";
import {createCopilotEscalationSchema, updateCopilotEscalationSchema} from "../validation/copilotEscalations.js";
import {AppError} from "../../../utils/appError.js";

// Escalations raised from the Chrome extension's Suggested Resolution panel
// (a 👎 rating), by any signed-in agent — not the TEAM_LEAD/ADMIN-only
// console flow in ../routes/escalations.js. Ownership is enforced in the
// service layer (an agent can only escalate/act on their own suggestions;
// TEAM_LEAD/ADMIN can act on any).
export const copilotEscalationController = {
  // POST /api/copilot-escalations
  create: asyncHandler(async (req, res) => {
    const parsed = createCopilotEscalationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
    const me = await authService.me(req.user.id);
    const escalation = await escalationService.createFromAudit(
      parsed.data.auditRequestId,
      parsed.data.reason,
      me.email
    );
    res.status(201).json({ success: true, message: "Escalation created", data: escalation });
  }),

  // PUT /api/copilot-escalations/:id/status
  updateStatus: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateCopilotEscalationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
    const me = await authService.me(req.user.id);
    const escalation = await escalationService.updateStatusAsAgent(
      id,
      parsed.data.status,
      me.email,
      me.role
    );
    res.status(200).json({ success: true, message: "Escalation updated", data: escalation });
  }),
};

export default copilotEscalationController;
