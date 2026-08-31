import { assistantService } from "../service/assistant.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { askAssistantSchema } from "../validation/assistant.js";
import { AppError } from "../../../utils/appError.js";

export const assistantController = {
  // POST /api/assistant/ask — any authenticated user.
  ask: asyncHandler(async (req, res) => {
    const parsed = askAssistantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const result = await assistantService.ask(parsed.data);
    res.status(200).json({ success: true, message: "Assistant reply generated", data: result });
  }),

  // POST /api/assistant/ask/stream — same request/auth as ask(), but
  // responds as SSE so the frontend can render the answer as it's
  // generated instead of showing a blank spinner for up to ~90s.
  //
  // Deliberately NOT wrapped in asyncHandler: once headers are flushed,
  // errors can no longer go through the normal JSON error middleware
  // (res.headersSent would make it blow up trying to res.json() again) —
  // they're reported as a final SSE `error` event instead, handled here.
  askStream: async (req, res) => {
    const parsed = askAssistantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message, data: null });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Abort the in-flight embedding/chat calls if the client disconnects
    // (panel closed, page navigated away, a new question sent) — otherwise
    // a heavy local model keeps grinding on a question nobody's waiting on
    // anymore, and stalls the next real request behind it.
    const controller = new AbortController();
    res.on("close", () => controller.abort());

    const send = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await assistantService.askStream(parsed.data, send, { signal: controller.signal });
    } catch (e) {
      if (e.name !== "AbortError") {
        send({ stage: "error", detail: e instanceof AppError ? e.message : "Something went wrong." });
      }
    } finally {
      res.end();
    }
  },
};

export default assistantController;
