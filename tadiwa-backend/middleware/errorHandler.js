import {AppError} from '../utils/appError.js';

export const errorHandler = (err, req, res, next) => {
    if(err instanceof AppError){
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            data: null
        });
    }

    console.error(err);
    return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        data: null
    });
};

export default errorHandler;