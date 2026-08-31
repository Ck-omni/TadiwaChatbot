import { Router } from "express";
import { assistantController } from "../controller/assistant.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";

const router = Router();

router.use(authMiddleware);

// POST /api/assistant/ask — any authenticated user (same access as
// GET /api/knowledge-base, which this feeds off of).
router.post("/ask", assistantController.ask);

// POST /api/assistant/ask/stream — same, but as SSE (see controller).
router.post("/ask/stream", assistantController.askStream);

export default router;
