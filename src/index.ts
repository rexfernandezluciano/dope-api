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

// Define the CORS middleware
const corsOptions = {
	origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
		// Allow requests with no origin (like mobile apps or curl requests)
		if (!origin) return callback(null, true);
		
		// Allow all origins in development
		if (process.env.NODE_ENV !== 'production') {
			return callback(null, true);
		}
		
		// In production, you might want to restrict to specific domains
		// For now, allowing all origins
		return callback(null, true);
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
	allowedHeaders: [
		"Content-Type",
		"Authorization",
		"X-CSRF-Token",
		"X-Requested-With",
		"Accept",
		"Accept-Version",
		"Content-Length",
		"Content-MD5",
		"Date",
		"X-Api-Version",
		"X-File-Name",
		"Origin",
		"X-Firebase-AppCheck",
	],
	exposedHeaders: ["Content-Length", "X-Api-Version"],
	preflightContinue: false,
	optionsSuccessStatus: 200,
};

// Use CORS globally for all routes
app.use(cors(corsOptions));

app.use(express.json());
app.set("json spaces", 2);

// Session configuration with database storage
app.use(session({
	secret: process.env.SESSION_SECRET || "your-secret-key",
	resave: false,
	saveUninitialized: false,
	store: new CustomPrismaSessionStore(),
	cookie: {
		secure: process.env.NODE_ENV === "production",
		maxAge: 24 * 60 * 60 * 1000, // 24 hours
		httpOnly: true
	}
}));

// Add IP tracking middleware
app.use(enhanceSession);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

const BASE_PATH = "/v1";

// Handle preflight OPTIONS requests explicitly
app.options('*', cors(corsOptions));

app.get("/", (req: Request, res: Response) => {
	res.json({ status: "ok", message: "API is running." });
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
