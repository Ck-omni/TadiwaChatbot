import { scheduleService } from "../service/schedule.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { createShiftBlockSchema, updateShiftBlockSchema } from "../validation/schedule.js";
import { AppError } from "../../../utils/appError.js";

const isPrivileged = (role) => role === "ADMIN" || role === "TEAM_LEAD";

export const scheduleController = {
  // GET /schedule?date=YYYY-MM-DD&userId= — defaults to today and to the
  // caller's own schedule. Only TEAM_LEAD/ADMIN may pass a different userId.
  list: asyncHandler(async (req, res) => {
    const { date } = req.query;
    const requestedUserId = req.query.userId ? Number(req.query.userId) : req.user.id;

    if (requestedUserId !== req.user.id && !isPrivileged(req.user.role)) {
      throw new AppError("You do not have permission to view another user's schedule", 403);
    }

    const blocks = await scheduleService.listForUser(requestedUserId, date);
    res.status(200).json({ success: true, message: "Schedule retrieved", data: blocks });
  }),

  // GET /schedule/peers?date=YYYY-MM-DD — everyone else on shift that day.
  peers: asyncHandler(async (req, res) => {
    const { date } = req.query;
    const peers = await scheduleService.listPeers(date, req.user.id);
    res.status(200).json({ success: true, message: "Shift peers retrieved", data: peers });
  }),

  // POST /schedule/blocks — TEAM_LEAD/ADMIN only (enforced in routes).
  create: asyncHandler(async (req, res) => {
    const parsed = createShiftBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const block = await scheduleService.create({ ...parsed.data, createdByUserId: req.user.id });
    res.status(201).json({ success: true, message: "Shift block created", data: block });
  }),

  // PUT /schedule/blocks/:id — TEAM_LEAD/ADMIN only (enforced in routes).
  update: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateShiftBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const block = await scheduleService.update(id, parsed.data);
    res.status(200).json({ success: true, message: "Shift block updated", data: block });
  }),

  // DELETE /schedule/blocks/:id — TEAM_LEAD/ADMIN only (enforced in routes).
  remove: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await scheduleService.remove(id);
    res.status(200).json({ success: true, message: "Shift block deleted", data: null });
  }),
};

export default scheduleController;
