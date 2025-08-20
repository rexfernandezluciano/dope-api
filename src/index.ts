/** @format */

import express, { Application, Request, Response } from "express";
import cors from "cors";
import * as dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import postRoutes from "./routes/post.routes";
import commentRoutes from "./routes/comment.routes";
import userRoutes from "./routes/user.routes";

dotenv.config();
const app: Application = express();
const PORT = process.env.PORT || 5000;

// CORS configuration to allow all requests from any host
app.use(
	cors({
		origin: true,
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"X-CSRF-Token",
			"X-Requested-With",
			"Accept",
			"Origin",
			"X-Firebase-AppCheck",
		],
		exposedHeaders: ["Content-Length", "X-Foo", "X-Bar"],
		preflightContinue: false,
		optionsSuccessStatus: 204,
	}),
);

app.use(express.json());
app.set("json spaces", 2);

// Handle preflight requests
app.options("*", (req: Request, res: Response) => {
	res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
	res.header("Access-Control-Allow-Credentials", "true");
	res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
	res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Origin, X-Firebase-AppCheck");
	res.sendStatus(204);
});

app.get("/", (req: Request, res: Response) => {
	res.json({ status: "ok", message: "API is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/users", userRoutes);

// Import error handlers
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

app.listen(PORT as number, "0.0.0.0", () => {
	console.log(`Server running on http://0.0.0.0:${PORT}`);
});

module.exports = app;
