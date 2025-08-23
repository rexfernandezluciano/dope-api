/** @format */

import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import session from "express-session";
import passport from "./config/passport";
import { CustomPrismaSessionStore } from "./config/session";
import { enhanceSession } from "./middleware/session.middleware";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import postRoutes from "./routes/post.routes";
import commentRoutes from "./routes/comment.routes";
import replyRoutes from "./routes/reply.routes";
import imageRoutes from "./routes/image.routes";
import reportRoutes from "./routes/report.routes";
import blockRoutes from "./routes/block.routes";
import paymentRoutes from "./routes/payment.routes";
import sessionRoutes from "./routes/session.routes";
import contentRoutes from "./routes/content.routes";
import recommendationRoutes from "./routes/recommendation.routes";
import businessRoutes from "./routes/business.routes";
import analyticsRoutes from "./routes/analytics.routes";
import activitypubRoutes from "./routes/activitypub.routes"; // Assuming this route file exists

dotenv.config();
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Use CORS globally for all routes
app.use(cors({ origin: "*" }));

// Middleware to parse JSON bodies into JS objects
app.use(express.json());
app.set("json spaces", 2);

// Server Name and Powered By Headers
app.use((req: Request, res: Response, next: NextFunction) => {
	res.setHeader("Server", "DOPE/1.0");
	res.setHeader("X-Powered-By", "DOPE/1.0");
	res.setHeader("X-Origin", "DOPE/1.0");
	res.setHeader("X-Content-Type-Options", "nosniff");
	next();
});

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

const API_VERSION = "/v1";

app.get("/", (req: Request, res: Response) => {
	const origin = req.headers.origin;
	res.json({ status: "ok", message: "API is accessed on " + origin });
});

app.use(`${API_VERSION}/auth`, authRoutes);
app.use(`${API_VERSION}/users`, userRoutes);
app.use(`${API_VERSION}/posts`, postRoutes);
app.use(`${API_VERSION}/comments`, commentRoutes);
app.use(`${API_VERSION}/replies`, replyRoutes);
app.use(`${API_VERSION}/reports`, reportRoutes);
app.use(`${API_VERSION}/blocks`, blockRoutes);
app.use(`${API_VERSION}/payments`, paymentRoutes);
app.use(`${API_VERSION}/sessions`, sessionRoutes);
app.use(`${API_VERSION}/content`, contentRoutes);
app.use(`${API_VERSION}/images`, imageRoutes);
app.use(`${API_VERSION}/recommendations`, recommendationRoutes);
app.use(`${API_VERSION}/business`, businessRoutes);
app.use(`${API_VERSION}/analytics`, analyticsRoutes);

// Register ActivityPub routes
app.use("/activitypub", activitypubRoutes);

// WebFinger discovery route (must be at root level)
app.get('/.well-known/webfinger', async (req, res) => {
  const { webfinger } = await import('./controllers/activitypub.controller');
  return webfinger(req, res);
});

// Import error handlers
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

app.listen(PORT as number, () => {
	console.log(`Server running on port ${PORT}`);
});

export default app;
