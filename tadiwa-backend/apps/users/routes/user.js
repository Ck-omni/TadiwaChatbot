import { Router } from "express";
import {userController} from "../controller/user.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";
import {requireRole} from "../../../middleware/requireRole.js";

const router = Router();

router.use(authMiddleware);

// Self-service routes — registered before "/:id" so "me" is never swallowed
// by that wildcard. Any authenticated user, acting only on their own account.

// PUT    /api/v1/users/me           — edit own fullName/email (never role/isActive)
router.put("/me", userController.updateMe);

// PUT    /api/v1/users/me/password  — change own password (requires currentPassword)
router.put("/me/password", userController.changeMyPassword);

// DELETE /api/v1/users/me           — deactivate own account (soft delete)
router.delete("/me", userController.deactivateMe);

// GET  /api/v1/users        — ADMIN, TEAM_LEAD
router.get("/", requireRole("ADMIN", "TEAM_LEAD"), userController.list);

// GET  /api/v1/users/:id    — ADMIN, TEAM_LEAD
router.get("/:id", requireRole("ADMIN", "TEAM_LEAD"), userController.getById);

// POST /api/v1/users        — ADMIN only (create an agent/team-lead account)
router.post("/", requireRole("ADMIN"), userController.create);

// PUT  /api/v1/users/:id    — ADMIN only (update role/active status)
router.put("/:id", requireRole("ADMIN"), userController.update);

export default router;