/** @format */

import { Request, Response } from "express";
import { PrismaClient, Subscription } from "@prisma/client";

const prisma = new PrismaClient();

// GET users
export const getUsers = async (req: Request, res: Response) => {
	try {
		const users = await prisma.user.findMany();
		res.json(users);
	} catch (error) {
		res.status(500).json({ error: "Error fetching users" });
	}
};

// CREATE user
export const createUser = async (req: Request, res: Response) => {
	try {
		const { name, email, username, photoURL, subscription, privacy } = req.body;

		if (!name || !email || !username || !photoURL) {
			return res.status(400).json({ message: "Missing required fields" });
		}

		const newUser = await prisma.user.create({
			data: {
				name,
				email,
				username,
				photoURL,
				subscription: (subscription as Subscription) || "free",
				privacy: privacy || { profile: "public", comments: "public", sharing: true, chat: "public" },
			},
		});

		res.status(201).json(newUser);
	} catch (error) {
		res.status(500).json({ error: "Error creating user" });
	}
};
