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

app.use(cors());
app.use(express.json());
app.set("json spaces", 2);

app.get("/", (req: Request, res: Response) => {
	res.json({ status: "ok", message: "API is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/users", userRoutes);

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
