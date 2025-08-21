/** @format */

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import bcrypt from "bcryptjs";
import { connect } from "../database/database";
import { JwtPayload } from "../utils/jwt";

let prisma: any;

(async () => {
	prisma = await connect();
})();

// Configure Local Strategy
passport.use(
	new LocalStrategy(
		{
			usernameField: "email",
			passwordField: "password",
		},
		async (email, password, done) => {
			try {
				if (!prisma) {
					console.error("Prisma client not initialized");
					return done(new Error("Database connection error"));
				}

				const user = await prisma.user.findUnique({
					where: { email },
					include: { credentials: true },
				});

				if (!user) {
					return done(null, false, { message: "Invalid credentials" });
				}

				const cred = user.credentials.find((c: any) => c.provider === "local");
				if (!cred?.passwordHash) {
					return done(null, false, { message: "Invalid credentials" });
				}

				const isMatch = await bcrypt.compare(password, cred.passwordHash);
				if (!isMatch) {
					return done(null, false, { message: "Invalid credentials" });
				}

				if (!user.hasVerifiedEmail) {
					return done(null, false, { message: "Email not verified" });
				}

				return done(null, user);
			} catch (error) {
				console.error("Local strategy error:", error);
				return done(error);
			}
		},
	),
);

// Configure Google Strategy
passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
			callbackURL: process.env.GOOGLE_CALLBACK_URL || "/v1/auth/google/callback",
		},
		async (accessToken, refreshToken, profile, done) => {
			try {
				const email = profile.emails?.[0]?.value;
				const name = profile.displayName;
				const photoURL = profile.photos?.[0]?.value;

				if (!email || !name) {
					return done(null, false, { message: "Invalid Google profile" });
				}

				// Check if user exists
				let user = await prisma.user.findUnique({ where: { email } });

				if (user) {
					return done(null, user);
				}

				// Create new user
				let username = email.split("@")[0] || "";
				let existingUser = await prisma.user.findUnique({
					where: { username },
				});
				let counter = 1;
				while (existingUser) {
					username = `${email.split("@")[0]}_${counter}`;
					existingUser = await prisma.user.findUnique({ where: { username } });
					counter++;
				}

				const subscription = "free";
				const privacy = {
					profile: "public",
					comments: "public",
					sharing: true,
					chat: "public",
				};

				user = await prisma.user.create({
					data: {
						name,
						email,
						username,
						photoURL: photoURL || "",
						password: "",
						subscription,
						hasBlueCheck: false,
						privacy,
						hasVerifiedEmail: true,
					},
				});

				await prisma.credential.create({
					data: {
						userId: user.uid,
						provider: "google",
					},
				});

				return done(null, user);
			} catch (error) {
				return done(error);
			}
		},
	),
);

// Configure JWT Strategy
passport.use(
	new JwtStrategy(
		{
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: process.env.JWT_SECRET || "BXvRq8D03IHvybiQ6Fjls2pkPJLXjx9x",
		},
		async (payload: JwtPayload, done) => {
			try {
				const user = await prisma.user.findUnique({
					where: { uid: payload.uid },
				});

				if (user) {
					return done(null, user);
				} else {
					return done(null, false);
				}
			} catch (error) {
				return done(error);
			}
		},
	),
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
	done(null, user.uid);
});

// Deserialize user from session
passport.deserializeUser(async (uid: string, done) => {
	try {
		const user = await prisma.user.findUnique({ where: { uid } });
		done(null, user);
	} catch (error) {
		done(error);
	}
});

export default passport;
