import {escalationService} from "../service/escalations.js";
import {asyncHandler} from "../../../utils/asyncHandler.js";
import {updateEscalationSchema} from "../validation/escalations.js";
import {AppError} from "../../../utils/AppError.js";

export const escalationController = {
  // GET /escalations?status=OPEN — status filter is optional
  list: asyncHandler(async (req, res) => {
    const { status } = req.query;
    const escalations = await escalationService.list(status);
    res.status(200).json({ success: true, message: "Escalations retrieved", data: escalations });
  }),
 
  update: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateEscalationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
 
    const escalation = await escalationService.updateStatus(id, parsed.data.status);
    res.status(200).json({ success: true, message: "Escalation updated", data: escalation });
  }),
};
 
export default escalationController;