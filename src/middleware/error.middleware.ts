
/** @format */

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { PrismaClientKnownRequestError, PrismaClientValidationError } from "@prisma/client/runtime/library";

export interface AppError extends Error {
	statusCode?: number;
	isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
	statusCode: number;
	isOperational: boolean;

	constructor(message: string, statusCode: number = 500) {
		super(message);
		this.statusCode = statusCode;
		this.isOperational = true;
		Error.captureStackTrace(this, this.constructor);
	}
}

export const errorHandler = (
	err: Error | AppError,
	req: Request,
	res: Response,
	next: NextFunction
) => {
	let error = { ...err } as AppError;
	error.message = err.message;

	// Log error for debugging
	console.error(`Error: ${error.message}`, error);

	// Zod validation errors
	if (err instanceof ZodError) {
		const message = "Invalid input data";
		error = new CustomError(message, 400);
		return res.status(400).json({
			success: false,
			error: "Validation Error",
			message,
			details: err.issues.map((e: any) => ({
				field: e.path.join('.'),
				message: e.message
			}))
		});
	}

	// Prisma errors
	if (err instanceof PrismaClientKnownRequestError) {
		switch (err.code) {
			case 'P2002':
				error = new CustomError("Resource already exists", 409);
				return res.status(409).json({
					success: false,
					error: "Conflict Error",
					message: "Resource already exists",
					details: `Duplicate value for ${err.meta?.target || 'field'}`
				});
			case 'P2025':
				error = new CustomError("Resource not found", 404);
				return res.status(404).json({
					success: false,
					error: "Not Found Error",
					message: "Resource not found"
				});
			case 'P2003':
				error = new CustomError("Foreign key constraint failed", 400);
				return res.status(400).json({
					success: false,
					error: "Constraint Error",
					message: "Invalid reference to related resource"
				});
			default:
				error = new CustomError("Database error", 500);
				return res.status(500).json({
					success: false,
					error: "Database Error",
					message: "An error occurred while processing your request"
				});
		}
	}

	if (err instanceof PrismaClientValidationError) {
		error = new CustomError("Invalid database operation", 400);
		return res.status(400).json({
			success: false,
			error: "Validation Error",
			message: "Invalid data provided"
		});
	}

	// JWT errors
	if (err.name === 'JsonWebTokenError') {
		error = new CustomError("Invalid token", 401);
		return res.status(401).json({
			success: false,
			error: "Authentication Error",
			message: "Invalid or malformed token"
		});
	}

	if (err.name === 'TokenExpiredError') {
		error = new CustomError("Token expired", 401);
		return res.status(401).json({
			success: false,
			error: "Authentication Error",
			message: "Token has expired"
		});
	}

	// Custom operational errors
	if (error.isOperational) {
		return res.status(error.statusCode || 500).json({
			success: false,
			error: "Operational Error",
			message: error.message
		});
	}

	// Default server error
	res.status(500).json({
		success: false,
		error: "Internal Server Error",
		message: "Something went wrong on our end: " + error.message
	});
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
	const error = new CustomError(`Route ${req.originalUrl} not found`, 404);
	next(error);
};

export const asyncHandler = (fn: Function) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
};
