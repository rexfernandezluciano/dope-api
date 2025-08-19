/** @format */

export interface PrivacySettings {
	profile: "public" | "private";
	comments: "public" | "followers" | "private";
	sharing: boolean;
	chat: "public" | "followers" | "private";
}

export type Subscription = "free" | "premium" | "pro";

export interface Membership {
	subscription: Subscription;
	nextBillingDate?: Date;
}

export interface User {
	uid: string;
	name: string;
	email: string;
	username: string;
	photoURL: string;
	hasBlueCheck: boolean;
	membership: Membership;
	privacy: PrivacySettings;
	hasVerifiedEmail: boolean;
}
