import { Router } from "express";
import { chatController } from "../controller/chatController.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";

const router = Router();

router.use(authMiddleware);

// GET  /api/chats/peers                                — any authenticated user; who you can message
router.get("/peers", chatController.listPeers);

// GET  /api/chats/conversations                         — any authenticated user; my threads + last message + unread count
router.get("/conversations", chatController.listConversations);

// GET  /api/chats/conversations/:otherUserId/messages   — full history with one peer (empty array if no thread yet)
router.get("/conversations/:otherUserId/messages", chatController.getMessages);

// POST /api/chats/conversations/:otherUserId/read       — mark that peer's messages to me as read
router.post("/conversations/:otherUserId/read", chatController.markRead);

// POST /api/chats/messages                              — send { recipientId, content }; creates the thread if needed
router.post("/messages", chatController.sendMessage);

export default router;
