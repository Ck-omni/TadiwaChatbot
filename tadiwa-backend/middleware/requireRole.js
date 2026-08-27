import {AppError} from '../utils/appError.js';

export const requireRole = (...allowedRoles) => (req , res, next) =>{
    if(!req.user){
        return next(new AppError("Not authenticated", 401));
    }
    if(!allowedRoles.includes(req.user.role)){
        return next(new AppError("You do not have permission to perform this action", 403));
    }
    next();
}

export default requireRole;