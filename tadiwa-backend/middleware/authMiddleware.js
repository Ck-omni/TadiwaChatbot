import jwt from 'jsonwebtoken';
import {AppError} from '../utils/appError.js';

export const authMiddleware = (req, res, next) => {
    const header  = req.headers.authorization;
    if(!header || !header.startsWith('Bearer ')) {
        return next(new AppError('Missing or malformed authorization header', 401));
    }

    const token = header.slice("Bearer ".length);
    
    try{
        const payload = jwt.verify(token , process.env.JWT_SECRET);
        // signAccessToken signs { userId, role } — not { id, role } — this
        // previously read payload.id (always undefined), so req.user.id was
        // undefined on every authenticated request past this middleware.
        req.user = {id: payload.userId, role: payload.role};
        next();
    }catch(error){
        next(new AppError("Invalid or expired access token", 401));
    }

}

export default authMiddleware;