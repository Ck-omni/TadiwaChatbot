import { prisma } from "../../../lib/prismaClient.js";
import {AppError} from "../../../utils/appError.js";
import { hashPassword, comparePassword } from "../../../utils/hash.js";

const PUBLIC_USER_FIELDS = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export const userService = {

  async list() {
    return prisma.user.findMany({
      select: PUBLIC_USER_FIELDS,
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER_FIELDS,
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  },

  async create({ email, password, fullName, role }) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("That email is already taken", 409);
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role: role ?? "AGENT",
      },
      select: PUBLIC_USER_FIELDS,
    });

    return user;
  },

  async update(id, updates) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("User not found", 404);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updates, // { fullName?, role?, isActive? } — never accepts password/username here
      select: PUBLIC_USER_FIELDS,
    });

    return user;
  },

  // Self-service — `updates` only ever contains fullName/email (see
  // updateOwnProfileSchema); role/isActive are structurally impossible here.
  async updateOwnProfile(userId, updates) {
    if (updates.email) {
      const existing = await prisma.user.findUnique({ where: { email: updates.email } });
      if (existing && existing.id !== userId) {
        throw new AppError("That email is already taken", 409);
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data: updates,
      select: PUBLIC_USER_FIELDS,
    });
  },

  async changeOwnPassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const currentMatches = await comparePassword(currentPassword, user.passwordHash);
    if (!currentMatches) {
      throw new AppError("Current password is incorrect", 401);
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Force re-login everywhere else — a password change should invalidate
    // any session started with the old one.
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // Soft delete: deactivates the account (same end state as an admin using
  // the Deactivate button) and revokes every refresh token, rather than
  // removing the User row — which chat sessions, escalations, shift blocks,
  // and productivity targets all reference. Reversible by an admin.
  async deactivateSelf(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};

export default userService;