/** @format */

import express, { Application, Request, Response } from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import session from "express-session";
import passport from "./config/passport";
import { CustomPrismaSessionStore } from "./config/session";
import { enhanceSession } from "./middleware/session.middleware";

import authRoutes from "./routes/auth.routes";
import postRoutes from "./routes/post.routes";
import commentRoutes from "./routes/comment.routes";
import userRoutes from "./routes/user.routes";
import sessionRoutes from "./routes/session.routes";

dotenv.config();
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Use CORS globally for all routes
app.use(cors());

app.use(express.json());
app.set("json spaces", 2);

// Session configuration with database storage
app.use(
	session({
		secret: process.env.SESSION_SECRET || "BXvRq8D03IHvybiQ6Fjls2pkPJLXjx9x",
		resave: false,
		saveUninitialized: false,
		store: new CustomPrismaSessionStore(),
		cookie: {
			secure: process.env.NODE_ENV === "production",
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
			httpOnly: true,
		},
	}),
);

// Add IP tracking middleware
app.use(enhanceSession);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

const BASE_PATH = "/v1";

app.get("/", (req: Request, res: Response) => {
	const origin = req.headers.origin;
	res.json({ status: "ok", message: "API is accessed on " + origin });
});

app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/posts`, postRoutes);
app.use(`${BASE_PATH}/comments`, commentRoutes);
app.use(`${BASE_PATH}/users`, userRoutes);
app.use(`${BASE_PATH}/sessions`, sessionRoutes);

// Import error handlers
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

app.listen(PORT as number, "0.0.0.0", () => {
	console.log(`Server running on http://0.0.0.0:${PORT}`);
});

export default app;
