import { notificationService } from "../service/notifications.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { AppError } from "../../../utils/appError.js";

export const notificationController = {
  // GET /notifications — merged feed: unread chat conversations + escalation events.
  list: asyncHandler(async (req, res) => {
    const feed = await notificationService.getFeed(req.user.id);
    res.status(200).json({ success: true, message: "Notifications retrieved", data: feed });
  }),

  // GET /notifications/count — lightweight, for a polling bell badge.
  count: asyncHandler(async (req, res) => {
    const unread = await notificationService.getUnreadCount(req.user.id);
    res.status(200).json({ success: true, message: "Unread count retrieved", data: { unread } });
  }),

  // POST /notifications/:id/read — escalation notifications only.
  markOneRead: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new AppError("Invalid notification id", 400);
    }
    const notification = await notificationService.markOneRead(req.user.id, id);
    res.status(200).json({ success: true, message: "Notification marked read", data: notification });
  }),

  // POST /notifications/read-all — escalation notifications + unread peer messages.
  markAllRead: asyncHandler(async (req, res) => {
    await notificationService.markAllRead(req.user.id);
    res.status(200).json({ success: true, message: "All notifications marked read", data: null });
  }),
};

export default notificationController;
