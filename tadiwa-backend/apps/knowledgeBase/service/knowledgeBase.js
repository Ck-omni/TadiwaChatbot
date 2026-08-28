import {prisma} from "../../../lib/prismaClient.js";
import {AppError} from "../../../utils/appError.js";

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
    return prisma.knowledgeBaseEntry.create({
      data: { topic, content, updatedBy },
    });
  },

  // Same as create(), plus `source` — the original filename, for entries
  // authored via POST /api/knowledge-base/upload (see textExtraction.js).
  // Kept separate from create() so the plain JSON create contract
  // (topic/content only) doesn't have to grow an upload-only field.
  async createFromUpload({ topic, content, source }, updatedBy) {
    return prisma.knowledgeBaseEntry.create({
      data: { topic, content, source, updatedBy },
    });
  },

  async update(id, updates, updatedBy) {
    const existing = await prisma.knowledgeBaseEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("Knowledge base entry not found", 404);
    }
 
    return prisma.knowledgeBaseEntry.update({
      where: { id },
      data: { ...updates, updatedBy },
    });
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