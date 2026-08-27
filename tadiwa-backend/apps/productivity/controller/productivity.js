import { productivityService } from "../service/productivity.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { setTargetSchema } from "../validation/productivity.js";
import { AppError } from "../../../utils/appError.js";

export const productivityController = {
  // GET /productivity?weekStart=YYYY-MM-DD — defaults to the current week.
  // TEAM_LEAD/ADMIN get every active user's row; anyone else gets only their own.
  list: asyncHandler(async (req, res) => {
    const { weekStart } = req.query;
    const rows = await productivityService.list({ weekStart, requestingUser: req.user });
    res.status(200).json({ success: true, message: "Productivity retrieved", data: rows });
  }),

  // POST /productivity/targets — TEAM_LEAD/ADMIN only (enforced in routes).
  setTarget: asyncHandler(async (req, res) => {
    const parsed = setTargetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const target = await productivityService.setTarget({ ...parsed.data, setByUserId: req.user.id });
    res.status(200).json({ success: true, message: "Target set", data: target });
  }),
};

export default productivityController;
