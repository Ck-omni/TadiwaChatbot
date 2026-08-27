import { dashboardService } from "../service/dashboard.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const dashboardController = {
  // GET /dashboard/summary?weekStart=YYYY-MM-DD — any authenticated user;
  // every field here is a team-wide aggregate, never per-user detail, so
  // there's nothing role-sensitive to gate.
  summary: asyncHandler(async (req, res) => {
    const { weekStart } = req.query;
    const summary = await dashboardService.getSummary(weekStart);
    res.status(200).json({ success: true, message: "Dashboard summary retrieved", data: summary });
  }),
};

export default dashboardController;
