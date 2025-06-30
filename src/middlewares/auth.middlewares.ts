import { NextFunction, Request, Response } from "express";
import rateLimit from 'express-rate-limit';

interface CustomError extends Error {
    statusCode?: number;
    status?: string;
  }

export const errorHandler = (err: CustomError, req: Request, res: Response, next: NextFunction) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    
    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
      next();
}

// RATE LIMIT
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10
})

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
})