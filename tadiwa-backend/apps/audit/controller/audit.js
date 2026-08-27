import { auditService } from "../service/audit.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

export const auditController = {
  // GET /audit?username=&captureSource=&rating=&from=&to=&limit= — all optional
  list: asyncHandler(async (req, res) => {
    const { username, captureSource, rating, from, to, limit } = req.query;
    const entries = await auditService.list(
      { username, captureSource, rating, from, to },
      { limit }
    );
    res.status(200).json({ success: true, message: "Audit log retrieved", data: entries });
  }),
};

export default auditController;
