import {Router} from 'express';
import multer from 'multer';
import { knowledgeBaseController } from '../controller/knowledgeBase.js';
import authMiddleware from '../../../middleware/authMiddleware.js';
import {requireRole} from '../../../middleware/requireRole.js';
import { AppError } from '../../../utils/appError.js';
import { ACCEPTED_EXTENSIONS, extensionOf } from '../service/textExtraction.js';

const router = Router();
router.use(authMiddleware);

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB — generous for a text guide/manual

// Memory storage: files are small text documents, never written to disk —
// extractText (textExtraction.js) reads straight from the buffer.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.originalname))) {
      cb(new AppError(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(", ")}.`, 415));
      return;
    }
    cb(null, true);
  },
});

// Normalizes multer's own errors (wrong field name, file too large) into the
// AppError shape errorHandler expects — left as a bare MulterError, these
// would otherwise surface to the client as an opaque 500.
function handleUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(new AppError(`File too large — max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`, 413));
    }
    next(err);
  });
}

// GET  /api/v1/knowledge-base       — any authenticated user (feeds the chat prompt)
router.get("/", knowledgeBaseController.list);

// GET  /api/v1/knowledge-base/:id   — any authenticated user
router.get("/:id", knowledgeBaseController.getById);

// POST /api/v1/knowledge-base       — ADMIN only
router.post("/", requireRole("ADMIN"), knowledgeBaseController.create);

// POST /api/v1/knowledge-base/upload — ADMIN only. multipart/form-data:
// `file` (PDF/DOCX/TXT/MD, see textExtraction.js) + optional `topic`.
router.post("/upload", requireRole("ADMIN"), handleUpload, knowledgeBaseController.uploadCreate);

// PUT  /api/v1/knowledge-base/:id   — ADMIN only
router.put("/:id", requireRole("ADMIN"), knowledgeBaseController.update);

// DELETE /api/v1/knowledge-base/:id — ADMIN only, soft deactivate (not a hard delete)
router.delete("/:id", requireRole("ADMIN"), knowledgeBaseController.remove);

export default router;