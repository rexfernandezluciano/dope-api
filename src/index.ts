import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import session from "express-session";
import rateLimit from "express-rate-limit";
import passport from "./config/passport";
import { CustomPrismaSessionStore } from "./config/session";
import { enhanceSession } from "./middleware/session.middleware";
import { connect } from "./database/database";

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
import pollRoutes from "./routes/poll.routes";

// Import Swagger configuration
import { specs, swaggerUi } from "./config/swagger";

import activityPubRoutes from "./routes/activitypub.routes";
// Import error handlers
import {
	errorHandler,
	notFoundHandler,
} from "./middleware/error.middleware";

dotenv.config();

const app: Application = express();

// Configure trust proxy more securely for rate limiting
app.set("trust proxy", 1); // Trust first proxy only

// Global middleware setup
app.use(cors({ origin: "*" }));

// Rate limiting middleware
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // limit each IP to 100 requests per windowMs
	standardHeaders: true,
	legacyHeaders: false,
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // Limit each IP to 10 auth requests per windowMs
	message: {
		error: "Too many authentication attempts, please try again later.",
		retryAfter: "15 minutes"
	},
	standardHeaders: true,
	legacyHeaders: false,
});

// Apply general rate limiting to all requests
app.use(limiter);

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

// Initialize database connection and session store once
let prisma: any = null;
let sessionStore: any = null;
let sessionMiddleware: any = null;

async function initializeSession() {
	if (!sessionMiddleware) {
		prisma = await connect();
		sessionStore = new CustomPrismaSessionStore(prisma);

		sessionMiddleware = session({
			secret: process.env.SESSION_SECRET || "BXvRq8D03IHvybiQ6Fjls2pkPJLXjx9x",
			resave: false,
			saveUninitialized: false,
			store: sessionStore,
			cookie: {
				secure: process.env.NODE_ENV === "production",
				maxAge: 24 * 60 * 60 * 1000, // 24 hours
				httpOnly: true,
			},
		});
	}
	return sessionMiddleware;
}

// Session middleware with proper initialization
app.use(async (req: Request, res: Response, next: NextFunction) => {
	try {
		const middleware = await initializeSession();
		middleware(req, res, next);
	} catch (error) {
		console.error("Session initialization error:", error);
		next(error);
	}
});

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

app.use(`${API_VERSION}/auth`, authLimiter, authRoutes);
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

// ActivityPub routes
app.use("/activitypub", activityPubRoutes);

// OAuth routes
const oauthRoutes = require("./routes/oauth.routes").default;
app.use("/oauth", oauthRoutes);

// Well-known routes
const wellKnownRoutes = require("./routes/well-known.routes").default;
app.use("/.well-known", wellKnownRoutes);

// Poll routes
app.use(`${API_VERSION}/polls`, pollRoutes);

// Swagger API documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'DOPE Network API Documentation',
  customfavIcon: '/favicon.ico'
}));

// API docs JSON endpoint
app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

// User profile endpoint with ActivityPub content negotiation
app.get("/@:username", (req: Request, res: Response) => {
	const { username } = req.params;

	// Check if client accepts ActivityPub
	const accept = req.headers.accept || "";
	if (
		accept.includes("application/activity+json") ||
		accept.includes("application/ld+json")
	) {
		// Redirect to ActivityPub actor endpoint
		return res.redirect(301, `/activitypub/users/${username}`);
	}

	// For web browsers, you could serve a user profile page here
	res.status(404).json({ error: "Profile page not yet implemented" });
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// For local development
if (process.env.NODE_ENV !== 'production') {
	const PORT = process.env.PORT || 5000;
	app.listen(PORT as number, "0.0.0.0", () => {
		console.log(`Server running on port ${PORT}`);
	});
}

export default app;