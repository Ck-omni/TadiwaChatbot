import {Router} from 'express';
import { knowledgeBaseController } from '../controller/knowledgeBase.js';
import authMiddleware from '../../../middleware/authMiddleware.js';
import {requireRole} from '../../../middleware/requireRole.js';

const router = Router();
router.use(authMiddleware);
 
// GET  /api/v1/knowledge-base       — any authenticated user (feeds the chat prompt)
router.get("/", knowledgeBaseController.list);
 
// GET  /api/v1/knowledge-base/:id   — any authenticated user
router.get("/:id", knowledgeBaseController.getById);
 
// POST /api/v1/knowledge-base       — ADMIN only
router.post("/", requireRole("ADMIN"), knowledgeBaseController.create);
 
// PUT  /api/v1/knowledge-base/:id   — ADMIN only
router.put("/:id", requireRole("ADMIN"), knowledgeBaseController.update);
 
// DELETE /api/v1/knowledge-base/:id — ADMIN only, soft deactivate (not a hard delete)
router.delete("/:id", requireRole("ADMIN"), knowledgeBaseController.remove);
 
export default router;