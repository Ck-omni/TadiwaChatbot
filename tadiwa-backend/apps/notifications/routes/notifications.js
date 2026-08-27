import { Router } from "express";
import { notificationController } from "../controller/notifications.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";

const router = Router();

router.use(authMiddleware);

// GET /api/notifications — any authenticated user; always scoped to req.user.id.
router.get("/", notificationController.list);

// GET /api/notifications/count
router.get("/count", notificationController.count);

// POST /api/notifications/:id/read
router.post("/:id/read", notificationController.markOneRead);

// POST /api/notifications/read-all
router.post("/read-all", notificationController.markAllRead);

export default router;
