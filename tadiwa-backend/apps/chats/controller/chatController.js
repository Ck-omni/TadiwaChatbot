import { chatService } from "../service/chatService.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { sendMessageSchema } from "../validation/chatValidation.js";
import { AppError } from "../../../utils/appError.js";

function parseUserIdParam(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid user id", 400);
  }
  return id;
}

export const chatController = {
  listPeers: asyncHandler(async (req, res) => {
    const peers = await chatService.listPeers(req.user.id);
    res.status(200).json({ success: true, message: "Peers retrieved", data: peers });
  }),

  listConversations: asyncHandler(async (req, res) => {
    const conversations = await chatService.listConversations(req.user.id);
    res.status(200).json({ success: true, message: "Conversations retrieved", data: conversations });
  }),

  getMessages: asyncHandler(async (req, res) => {
    const otherUserId = parseUserIdParam(req.params.otherUserId);
    const messages = await chatService.getMessages(req.user.id, otherUserId);
    res.status(200).json({ success: true, message: "Messages retrieved", data: messages });
  }),

  sendMessage: asyncHandler(async (req, res) => {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const message = await chatService.sendMessage(req.user.id, parsed.data.recipientId, parsed.data.content);
    res.status(201).json({ success: true, message: "Message sent", data: message });
  }),

  markRead: asyncHandler(async (req, res) => {
    const otherUserId = parseUserIdParam(req.params.otherUserId);
    const result = await chatService.markRead(req.user.id, otherUserId);
    res.status(200).json({ success: true, message: "Messages marked read", data: result });
  }),
};

export default chatController;
