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