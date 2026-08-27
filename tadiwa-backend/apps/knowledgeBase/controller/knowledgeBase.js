import { knowledgeBaseService } from "../service/knowledgeBase.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
} from "../validation/knowledgeBase.js";
import { AppError } from "../../../utils/appError.js";

export const knowledgeBaseController = {

  list: asyncHandler(async (req, res) => {
    const includeInactive = req.user.role === "ADMIN" && req.query.includeInactive === "true";
    const entries = await knowledgeBaseService.list({ includeInactive });
    res.status(200).json({ success: true, message: "Knowledge base entries retrieved", data: entries });
  }),

  getById: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const entry = await knowledgeBaseService.getById(id);
    res.status(200).json({ success: true, message: "Knowledge base entry retrieved", data: entry });
  }),

  create: asyncHandler(async (req, res) => {
    const parsed = createKnowledgeBaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const entry = await knowledgeBaseService.create(parsed.data, req.user.id);
    res.status(201).json({ success: true, message: "Knowledge base entry created", data: entry });
  }),

  update: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateKnowledgeBaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const entry = await knowledgeBaseService.update(id, parsed.data, req.user.id);
    res.status(200).json({ success: true, message: "Knowledge base entry updated", data: entry });
  }),

  remove: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const entry = await knowledgeBaseService.deactivate(id, req.user.id);
    res.status(200).json({ success: true, message: "Knowledge base entry deactivated", data: entry });
  }),
};

export default knowledgeBaseController;