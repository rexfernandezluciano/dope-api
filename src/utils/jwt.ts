/** @format */

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface JwtPayload {
	uid: string;
	email: string;
	username: string;
}

export function signToken(payload: JwtPayload) {
	return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
	return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
