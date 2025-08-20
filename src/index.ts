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
		origin: "*",
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"X-CSRF-Token",
			"X-Requested-With",
			"Accept",
			"Access-Control-Allow-Origin",
			"Access-Control-Allow-Methods",
			"Access-Control-Allow-Headers",
			"Access-Control-Allow-Credentials",
		],
	}),
);

app.use(express.json());
app.set("json spaces", 2);

app.get("/", (req: Request, res: Response) => {
	res.json({ status: "ok", message: "API is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/users", userRoutes);

app.listen(PORT as number, "0.0.0.0", () => {
	console.log(`Server running on http://0.0.0.0:${PORT}`);
});

module.exports = app;
