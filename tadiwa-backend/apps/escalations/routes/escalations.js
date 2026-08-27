import {Router} from "express";
import {escalationController} from "../controller/escalations.js";
import {authMiddleware} from "../../../middleware/authMiddleware.js";
import {requireRole} from "../../../middleware/requireRole.js";


const router = Router();
 
router.use(authMiddleware);
router.use(requireRole("TEAM_LEAD", "ADMIN"));
 
// GET /api/v1/escalations
router.get("/", escalationController.list);
 
// PUT /api/v1/escalations/:id
router.put("/:id", escalationController.update);
 
export default router;
 