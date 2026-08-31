import {prisma} from "../../../lib/prismaClient.js";
import {AppError} from "../../../utils/appError.js";
import {embedText, toVectorLiteral} from "../../../utils/llm.js";

// Prisma treats knowledge_base_entries.embedding (pgvector) as an
// "Unsupported" type — create()/update() can't touch it, so it's written
// separately via raw SQL right after the row exists. Best-effort: entries
// authored through this app used to be permanently unsearchable by the
// Chrome extension's RAG (and now the in-app AI Assistant) because nothing
// ever populated this column for them — see the extension's main.py
// retrieve_similar(), which already only scoped to `embedding IS NOT NULL`.
// If the local LLM is briefly unreachable, log and move on rather than
// failing the write the technician is waiting on; a NULL embedding just
// means this entry stays out of RAG results until the next successful
// edit or a backfill run (scripts/backfillKnowledgeBaseEmbeddings.js).
async function embedAndStore(id, content) {
  try {
    const vector = await embedText(content);
    await prisma.$executeRaw`
      UPDATE knowledge_base_entries SET embedding = ${toVectorLiteral(vector)}::vector WHERE id = ${id}
    `;
  } catch (e) {
    console.warn(`[knowledgeBase] failed to embed entry ${id}: ${e.message}`);
  }
}

export const knowledgeBaseService = {
  async list({ includeInactive = false } = {}) {
    return prisma.knowledgeBaseEntry.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { topic: "asc" },
    });
  },

  async listActive() {
    return prisma.knowledgeBaseEntry.findMany({
      where: { isActive: true },
      select: { topic: true, content: true },
      orderBy: { topic: "asc" },
    });
  },
 
  async getById(id) {
    const entry = await prisma.knowledgeBaseEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new AppError("Knowledge base entry not found", 404);
    }
    return entry;
  },
 
  async create({ topic, content }, updatedBy) {
    const entry = await prisma.knowledgeBaseEntry.create({
      data: { topic, content, updatedBy },
    });
    await embedAndStore(entry.id, content);
    return entry;
  },

  // Same as create(), plus `source` — the original filename, for entries
  // authored via POST /api/knowledge-base/upload (see textExtraction.js).
  // Kept separate from create() so the plain JSON create contract
  // (topic/content only) doesn't have to grow an upload-only field.
  async createFromUpload({ topic, content, source }, updatedBy) {
    const entry = await prisma.knowledgeBaseEntry.create({
      data: { topic, content, source, updatedBy },
    });
    await embedAndStore(entry.id, content);
    return entry;
  },

  async update(id, updates, updatedBy) {
    const existing = await prisma.knowledgeBaseEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("Knowledge base entry not found", 404);
    }

    const entry = await prisma.knowledgeBaseEntry.update({
      where: { id },
      data: { ...updates, updatedBy },
    });
    // Only the content actually affects meaning — don't burn an embedding
    // call re-embedding unchanged text on a topic-only or isActive-only edit.
    if (typeof updates.content === "string") {
      await embedAndStore(id, updates.content);
    }
    return entry;
  },
 
  async deactivate(id, updatedBy) {
    const existing = await prisma.knowledgeBaseEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("Knowledge base entry not found", 404);
    }
 
    return prisma.knowledgeBaseEntry.update({
      where: { id },
      data: { isActive: false, updatedBy },
    });
  },
};
 
export default knowledgeBaseService;