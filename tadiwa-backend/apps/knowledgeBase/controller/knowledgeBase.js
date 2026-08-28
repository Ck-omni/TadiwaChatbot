import { knowledgeBaseService } from "../service/knowledgeBase.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
} from "../validation/knowledgeBase.js";
import { AppError } from "../../../utils/appError.js";
import { extractText } from "../service/textExtraction.js";

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

  // POST /api/knowledge-base/upload — multipart/form-data: `file` (required,
  // see textExtraction.js for accepted types) + optional `topic` override.
  // Knowledge-base entries started out as PDFs re-typed by hand; this is
  // the "just upload the document" path, added for that same workflow plus
  // a few more formats (docx, txt, md).
  uploadCreate: asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError("A file is required.", 400);
    }

    const content = await extractText(req.file.buffer, req.file.originalname, req.file.mimetype);
    const fallbackTopic = req.file.originalname.replace(/\.[^./\\]+$/, "");
    const parsed = createKnowledgeBaseSchema.safeParse({
      topic: (req.body.topic || "").trim() || fallbackTopic,
      content,
    });
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const entry = await knowledgeBaseService.createFromUpload(
      { ...parsed.data, source: req.file.originalname },
      req.user.id
    );
    res.status(201).json({ success: true, message: "Knowledge base entry created from file", data: entry });
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