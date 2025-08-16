/** @format */

export interface PrivacySettings {
	profile: "public" | "private";
	comments: "public" | "followers" | "private";
	sharing: boolean;
	chat: "public" | "followers" | "private";
}

export type Subscription = "free" | "premium" | "pro";

export interface User {
	uid: number;
	name: string;
	email: string;
	username: string;
	photoURL: string;
	hasBlueCheck: boolean;
	subscription: Subscription;
	privacy: PrivacySettings;
	hasVerifiedEmail: boolean;
}
