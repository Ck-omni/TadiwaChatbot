import {userService} from "../service/userService.js";
import {asyncHandler} from "../../../utils/asyncHandler.js";
import {createUserSchema, updateUserSchema, updateOwnProfileSchema, changePasswordSchema} from "../validation/userValidation.js";
import {AppError} from "../../../utils/appError.js";

export const userController = {
  list: asyncHandler(async (req, res) => {
    const users = await userService.list();
    res.status(200).json({ success: true, message: "Users retrieved", data: users });
  }),

  getById: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const user = await userService.getById(id);
    res.status(200).json({ success: true, message: "User retrieved", data: user });
  }),

  create: asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const user = await userService.create(parsed.data);
    res.status(201).json({ success: true, message: "User created", data: user });
  }),

  update: asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const user = await userService.update(id, parsed.data);
    res.status(200).json({ success: true, message: "User updated", data: user });
  }),

  // PUT /users/me — self-service; req.user.id only, never a body-supplied id.
  updateMe: asyncHandler(async (req, res) => {
    const parsed = updateOwnProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const user = await userService.updateOwnProfile(req.user.id, parsed.data);
    res.status(200).json({ success: true, message: "Profile updated", data: user });
  }),

  // PUT /users/me/password — self-service.
  changeMyPassword: asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    await userService.changeOwnPassword(req.user.id, parsed.data.currentPassword, parsed.data.newPassword);
    res.status(200).json({ success: true, message: "Password changed", data: null });
  }),

  // DELETE /users/me — self-service; deactivates rather than removing the row.
  deactivateMe: asyncHandler(async (req, res) => {
    await userService.deactivateSelf(req.user.id);
    res.status(200).json({ success: true, message: "Account deactivated", data: null });
  }),
};

export default userController;
