import {prisma} from "../../../lib/prismaClient.js";
import {AppError} from "../../../utils/appError.js";
import { comparePassword} from "../../../utils/hash.js";
import{signAccessToken} from "../../../utils/jwt.js";
import {generateRefreshTokenValue , hashRefreshToken , parseDurationToMs} from "../../../utils/refreshToken.js";


const PUBLIC_USER_FIELDS = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
};
 
const REFRESH_TOKEN_TTL_MS = () =>
  parseDurationToMs(process.env.JWT_REFRESH_TOKEN_TTL || "7d");
 
export const authService = {
  async login(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
 
    // Same message whether the email doesn't exist or the password is
    // wrong — don't tell an attacker which one they got right.
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }
 
    const passwordMatches = await comparePassword(password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError("Invalid email or password", 401);
    }
 
    if (!user.isActive) {
      throw new AppError("This account has been deactivated", 403);
    }
 
    return issueTokenPair(user);
  },
 
  async refresh(rawRefreshToken) {
    const tokenHash = hashRefreshToken(rawRefreshToken);
 
    const stored = await prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });
 
    if (!stored) {
      throw new AppError("Invalid refresh token", 401);
    }
    if (stored.revokedAt) {
      throw new AppError("This refresh token has been revoked", 401);
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new AppError("This refresh token has expired", 401);
    }
    if (!stored.user.isActive) {
      throw new AppError("This account has been deactivated", 403);
    }
 
    const accessToken = signAccessToken({
      userId: stored.user.id,
      role: stored.user.role,
    });
 
    return { accessToken };
  },
 
  async logout(rawRefreshToken) {
    const tokenHash = hashRefreshToken(rawRefreshToken);
 
    // Idempotent: logging out with an already-invalid/unknown token is not
    // an error — the end state the caller wants (no valid session) is
    // already true.
    await prisma.refreshToken.updateMany({
      where: { token: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
 
  async me(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_FIELDS,
    });
 
    if (!user) {
      throw new AppError("User not found", 404);
    }
 
    return user;
  },
};
 
// Shared by login() today; a future register/invite flow can reuse this too.
async function issueTokenPair(user) {
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
 
  const rawRefreshToken = generateRefreshTokenValue();
  await prisma.refreshToken.create({
    data: {
      token: hashRefreshToken(rawRefreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS()),
    },
  });
 
  return {
    accessToken,
    refreshToken: rawRefreshToken, // raw value only ever leaves the server once, here
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  };
}
 
export default authService;