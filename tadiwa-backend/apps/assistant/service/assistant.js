// In-app "TADIWA" AI Assistant (AIAssistant.tsx): a RAG chat over the same
// knowledge_base_entries table and the same local Ollama models as the
// Chrome extension's ticket-copilot (helpdesk_browser_extension-main/
// backend/main.py) — embed the question, pull the nearest KB procedures,
// ground the chat completion in them. Unlike the extension's /api/suggest
// (which routes a ticket to exactly one procedure), this is an open,
// multi-turn Q&A the technician drives directly, so retrieval re-runs off
// the latest message each turn rather than a single ticket capture.
import { prisma } from "../../../lib/prismaClient.js";
import { embedText, chatCompletion, chatCompletionStream, toVectorLiteral } from "../../../utils/llm.js";

const RAG_TOP_K = Number(process.env.RAG_TOP_K || 5);
// Same default as the extension backend — minimum cosine similarity for a
// source to be worth citing. Retrieval still hands the LLM the full
// shortlist regardless (it, not this gate, decides relevance); this only
// trims what gets surfaced as a "source" in the response.
const RAG_MIN_SIM = Number(process.env.RAG_MIN_SIM || 0.35);

const SYSTEM_PREAMBLE = `You are TADIWA, the AI assistant for technical support technicians at Econet Zimbabwe.
Answer using ONLY the knowledge base excerpts provided below — they are the current official procedures.
If the excerpts don't cover the question, say so plainly rather than guessing or using outside knowledge.
Be professional, concise, and structure multi-step answers as a numbered list. Cite the procedure name
(e.g. "Per BSS › SIM Card Replacement...") when you draw from a specific excerpt.`;

function formatContext(rows) {
  if (rows.length === 0) return "(No knowledge base excerpts matched this question.)";
  return rows
    .map((r, i) => {
      const label = [r.topic, r.section].filter(Boolean).join(" › ");
      return `[${i + 1}] ${label}\n${r.content.slice(0, 1500)}`;
    })
    .join("\n\n");
}

// Shared by ask() and askStream(): embed the question, pull the nearest KB
// rows, and assemble the messages array + citation list both send to the
// LLM. `signal` (askStream only) ties the embedding call to the request's
// own lifetime — see the comment on chatCompletionStream's abort handling.
async function retrieveAndBuildMessages(message, history, { signal } = {}) {
  const queryVec = await embedText(message, { signal });
  const vectorLiteral = toVectorLiteral(queryVec);

  // Same shape/gating as the extension's retrieve_similar(): active rows
  // with an embedding, nearest first. Entries authored through the
  // knowledge-base UI are included here now that create/update embed
  // them automatically (see apps/knowledgeBase/service/knowledgeBase.js).
  const rows = await prisma.$queryRaw`
    SELECT topic, section, source, content,
           1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM knowledge_base_entries
    WHERE is_active AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${RAG_TOP_K}
  `;

  const messages = [
    { role: "system", content: `${SYSTEM_PREAMBLE}\n\nKNOWLEDGE BASE EXCERPTS:\n${formatContext(rows)}` },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: message },
  ];

  const sources = rows
    .filter((r) => r.similarity >= RAG_MIN_SIM)
    .map((r) => ({
      topic: r.topic,
      section: r.section,
      source: r.source,
      similarity: Math.round(r.similarity * 1000) / 1000,
    }));

  return { messages, sources };
}

export const assistantService = {
  // history: prior turns as already rendered in the UI, oldest first —
  // the new `message` is not included in it.
  async ask({ message, history = [] }) {
    const { messages, sources } = await retrieveAndBuildMessages(message, history);
    const answer = await chatCompletion(messages);
    return { answer, sources };
  },

  // Same pipeline as ask(), but reports progress and streams the answer
  // token-by-token via `onEvent` as it's generated instead of making the
  // caller wait ~30-90s (this model's typical local latency) for the whole
  // thing. `signal` aborts the in-flight LLM calls if the client
  // disconnects — see controller/assistant.js.
  async askStream({ message, history = [] }, onEvent, { signal } = {}) {
    onEvent({ stage: "retrieving" });
    const { messages, sources } = await retrieveAndBuildMessages(message, history, { signal });
    onEvent({ stage: "context", sources });

    onEvent({ stage: "generating" });
    const answer = await chatCompletionStream(
      messages,
      (delta) => onEvent({ stage: "token", content: delta }),
      { signal }
    );

    onEvent({ stage: "done", sources });
    return { answer, sources };
  },
};

export default assistantService;
