import jwt from 'jsonwebtoken';

export const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_TOKEN_TTL || "1h",
  });
};
 
export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
