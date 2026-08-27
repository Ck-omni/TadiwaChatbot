import crypto from "node:crypto";


export const generateRefreshTokenValue = () => {
  return crypto.randomBytes(48).toString("hex");
};
 
export const hashRefreshToken = (rawToken) => {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};
 
export const parseDurationToMs = (input) => {
  const match = /^(\d+)\s*(d|h|m|s)$/i.exec(String(input).trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${input}"`);
  }
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2].toLowerCase()];
  return value * unitMs;
};
 