// Thin client for the local Ollama instance, spoken over its OpenAI-compatible
// API — the same endpoints/models the Chrome extension's ticket-copilot
// backend uses (helpdesk_browser_extension-main/backend/main.py), so the two
// stay in sync by construction rather than by keeping two configs in step.
//
// Env vars (all optional — defaults match a local `ollama serve` with
// `ollama pull qwen2.5-coder:7b-instruct` + `ollama pull nomic-embed-text`):
//   LLM_BASE_URL    OpenAI-compatible chat base, e.g. http://127.0.0.1:11434/v1
//   LLM_MODEL       chat model tag, e.g. qwen2.5-coder:7b-instruct
//   LLM_API_KEY     usually unused locally (default "local")
//   LLM_TIMEOUT_MS  chat request timeout in ms (default 120000)
//   EMBED_BASE_URL  OpenAI-compatible embeddings base (defaults to LLM_BASE_URL)
//   EMBED_MODEL     embedding model tag, e.g. nomic-embed-text
//   EMBED_DIM       expected embedding width — must match the
//                   knowledge_base_entries.embedding column (vector(768))

import { AppError } from "./appError.js";

const LLM_BASE_URL = process.env.LLM_BASE_URL || "http://127.0.0.1:11434/v1";
const LLM_MODEL = process.env.LLM_MODEL || "qwen2.5-coder:7b-instruct";
const LLM_API_KEY = process.env.LLM_API_KEY || "local";
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 120000);

const EMBED_BASE_URL = process.env.EMBED_BASE_URL || LLM_BASE_URL;
const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";
export const EMBED_DIM = Number(process.env.EMBED_DIM || 768);

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${LLM_API_KEY}` };
}

// `externalSignal` lets a caller (the streaming chat route, tied to the
// HTTP request's own lifetime) fold its own cancellation in alongside the
// timeout — either one aborts the fetch. Node 20.3+'s AbortSignal.any does
// the combining.
async function withTimeout(promiseFactory, ms, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const signal = externalSignal ? AbortSignal.any([externalSignal, controller.signal]) : controller.signal;
  try {
    return await promiseFactory(signal);
  } finally {
    clearTimeout(timer);
  }
}

// Embeds one piece of text with the local embedding model. Truncated the
// same way as the extension backend (first 8000 chars) — plenty for a KB
// entry or a chat message, and keeps the request fast.
export async function embedText(text, { signal } = {}) {
  let res;
  try {
    res = await withTimeout(
      (fetchSignal) =>
        fetch(`${EMBED_BASE_URL.replace(/\/$/, "")}/embeddings`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ model: EMBED_MODEL, input: String(text).slice(0, 8000) }),
          signal: fetchSignal,
        }),
      LLM_TIMEOUT_MS,
      signal
    );
  } catch (e) {
    throw new AppError(`Embedding endpoint unreachable: ${e.message}`, 502);
  }
  if (!res.ok) {
    throw new AppError(`Embedding endpoint returned ${res.status}`, 502);
  }
  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) {
    throw new AppError("Unexpected response from embedding endpoint.", 502);
  }
  if (vec.length !== EMBED_DIM) {
    throw new AppError(
      `Embedding dim ${vec.length} != EMBED_DIM ${EMBED_DIM}. Set EMBED_DIM to match ${EMBED_MODEL}.`,
      500
    );
  }
  return vec;
}

// Chat completion against the local model. `messages` is the plain OpenAI
// shape: [{ role: 'system'|'user'|'assistant', content: string }, ...].
export async function chatCompletion(messages, { maxTokens = 900, temperature = 0.2, signal } = {}) {
  let res;
  try {
    res = await withTimeout(
      (fetchSignal) =>
        fetch(`${LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ model: LLM_MODEL, messages, max_tokens: maxTokens, temperature }),
          signal: fetchSignal,
        }),
      LLM_TIMEOUT_MS,
      signal
    );
  } catch (e) {
    throw new AppError(`Local LLM unreachable: ${e.message}`, 502);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AppError(`Local LLM returned ${res.status}. ${detail.slice(0, 200)}`, 502);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new AppError("Unexpected response from local LLM.", 502);
  }
  return content;
}

// Same call as chatCompletion, but with `stream: true` — Ollama's
// OpenAI-compatible endpoint then responds as SSE, one `data: {...}` chunk
// per token (`choices[0].delta.content`), ending with `data: [DONE]`.
// `onDelta` is called with each chunk of text as it arrives; the full
// concatenated answer is still returned once the stream ends, so callers
// don't have to reassemble it themselves.
export async function chatCompletionStream(messages, onDelta, { maxTokens = 900, temperature = 0.2, signal } = {}) {
  let res;
  try {
    res = await withTimeout(
      (fetchSignal) =>
        fetch(`${LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ model: LLM_MODEL, messages, max_tokens: maxTokens, temperature, stream: true }),
          signal: fetchSignal,
        }),
      LLM_TIMEOUT_MS,
      signal
    );
  } catch (e) {
    // Includes the deliberate abort when the client disconnects mid-stream
    // (assistant.js's route ties `signal` to the request) — that's not a
    // real failure, so let it propagate as a plain AbortError rather than
    // wrapping it in an AppError the caller would otherwise try to report.
    if (e.name === "AbortError") throw e;
    throw new AppError(`Local LLM unreachable: ${e.message}`, 502);
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new AppError(`Local LLM returned ${res.status}. ${detail.slice(0, 200)}`, 502);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let obj;
      try {
        obj = JSON.parse(payload);
      } catch {
        continue;
      }
      const delta = obj?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        full += delta;
        onDelta(delta);
      }
    }
  }
  if (!full) {
    throw new AppError("Local LLM stream returned no text.", 502);
  }
  return full;
}

// pgvector's text input format is a bracketed, comma-separated literal —
// `'[0.1,0.2,...]'::vector`. Prisma's raw-query tag has no native vector
// binding, so every caller passes this string through as a normal text
// parameter and casts it on the Postgres side (see knowledgeBase.js and
// apps/assistant/service/assistant.js).
export function toVectorLiteral(embedding) {
  return `[${embedding.join(",")}]`;
}
