/** @format */

import express, { Application, Request, Response } from "express";
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

dotenv.config();
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Use CORS globally for all routes
app.use(cors({ origin: "*" }));

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

app.use("/v1/auth", authRoutes);
app.use("/v1/users", userRoutes);
app.use("/v1/posts", postRoutes);
app.use("/v1/comments", commentRoutes);
app.use("/v1/replies", replyRoutes);
app.use("/v1/reports", reportRoutes);
app.use("/v1/blocks", blockRoutes);
app.use("/v1/payments", paymentRoutes);
app.use("/v1/sessions", sessionRoutes);
app.use("/v1/content", contentRoutes);
app.use("/v1/sessions", sessionRoutes);

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