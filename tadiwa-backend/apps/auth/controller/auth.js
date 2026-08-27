import {authService} from "../service/auth.js";
import {asyncHandler} from "../../../utils/asyncHandler.js";
import {loginSchema ,  refreshSchema} from "../validation/auth.js";
import {AppError} from "../../../utils/AppError.js";

export const authController = {
  login: asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
 
    const { email, password } = parsed.data;
    const result = await authService.login(email, password);
 
    res.status(200).json({ success: true, message: "Logged in", data: result });
  }),
 
  refresh: asyncHandler(async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
 
    const result = await authService.refresh(parsed.data.refreshToken);
 
    res.status(200).json({ success: true, message: "Access token refreshed", data: result });
  }),
 
  logout: asyncHandler(async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
 
    await authService.logout(parsed.data.refreshToken);
 
    res.status(200).json({ success: true, message: "Logged out", data: null });
  }),
 
  me: asyncHandler(async (req, res) => {
    const user = await authService.me(req.user.id);
    res.status(200).json({ success: true, message: "Current user", data: user });
  }),
};
 
export default authController;
