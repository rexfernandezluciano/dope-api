/** @format */

import jwt, { JwtPayload as JsonWebTokenPayload } from "jsonwebtoken";

const JWT_SECRET: string = process.env.JWT_SECRET || "BXvRq8D03IHvybiQ6Fjls2pkPJLXjx9x";
const JWT_EXPIRES_IN: number = parseInt(process.env.JWT_EXPIRES_IN || "604800"); // 7 days = 168 hours = 604800 seconds

export interface JwtPayload {
	uid: string;
	email: string;
	username: string;
}

export function signToken(payload: JwtPayload): string {
	return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
	const decoded = jwt.verify(token, JWT_SECRET) as JsonWebTokenPayload;
	return decoded as JwtPayload;
}
