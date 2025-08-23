
import crypto from 'crypto';
import axios from 'axios';
import { parseMentionsToNames } from './mentions';

// Send ActivityPub activity to remote actor's inbox
export async function sendActivity(activity: any, targetInbox: string, actorPrivateKey: string) {
	try {
		const activityJson = JSON.stringify(activity);
		const url = new URL(targetInbox);
		
		// Create HTTP signature
		const date = new Date().toUTCString();
		const signature = await createHttpSignature(
			'POST',
			url.pathname,
			url.hostname,
			activityJson,
			actorPrivateKey,
			activity.actor + '#main-key'
		);

		const response = await axios.post(targetInbox, activity, {
			headers: {
				'Content-Type': 'application/activity+json',
				'Date': date,
				'Signature': signature
			}
		});

		return response.status === 202 || response.status === 200;
	} catch (error) {
		console.error('Failed to send ActivityPub activity:', error);
		return false;
	}
}

// Create HTTP signature for ActivityPub requests
async function createHttpSignature(
	method: string,
	path: string,
	host: string,
	body: string,
	privateKey: string,
	keyId: string
): Promise<string> {
	const date = new Date().toUTCString();
	const digest = `SHA-256=${crypto.createHash('sha256').update(body).digest('base64')}`;
	
	const stringToSign = [
		`(request-target): ${method.toLowerCase()} ${path}`,
		`host: ${host}`,
		`date: ${date}`,
		`digest: ${digest}`
	].join('\n');

	const signer = crypto.createSign('sha256');
	signer.update(stringToSign);
	const signature = signer.sign(privateKey, 'base64');

	return `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signature}"`;
}

// Fetch remote actor information
export async function fetchActor(actorUrl: string) {
	try {
		const response = await axios.get(actorUrl, {
			headers: {
				'Accept': 'application/activity+json'
			}
		});
		return response.data;
	} catch (error) {
		console.error('Failed to fetch actor:', error);
		return null;
	}
}

// Create Follow activity
export function createFollowActivity(actorUrl: string, targetActorUrl: string, baseUrl: string) {
	return {
		"@context": "https://www.w3.org/ns/activitystreams",
		id: `${baseUrl}/activities/${crypto.randomUUID()}`,
		type: "Follow",
		actor: actorUrl,
		object: targetActorUrl
	};
}

// Create Undo Follow activity
export function createUndoFollowActivity(followActivity: any, baseUrl: string) {
	return {
		"@context": "https://www.w3.org/ns/activitystreams",
		id: `${baseUrl}/activities/${crypto.randomUUID()}`,
		type: "Undo",
		actor: followActivity.actor,
		object: followActivity
	};
}

// Create Like activity
export function createLikeActivity(actorUrl: string, objectUrl: string, baseUrl: string) {
	return {
		"@context": "https://www.w3.org/ns/activitystreams",
		id: `${baseUrl}/activities/${crypto.randomUUID()}`,
		type: "Like",
		actor: actorUrl,
		object: objectUrl
	};
}

// Create Create Note activity (for posts)
export async function createNoteActivity(actorUrl: string, content: string, baseUrl: string, postId: string) {
	const noteUrl = `${baseUrl}/posts/${postId}`;
	
	// Parse mentions (@uid) to display names
	const processedContent = await parseMentionsToNames(content);
	
	return {
		"@context": "https://www.w3.org/ns/activitystreams",
		id: `${noteUrl}/activity`,
		type: "Create",
		actor: actorUrl,
		published: new Date().toISOString(),
		to: ["https://www.w3.org/ns/activitystreams#Public"],
		object: {
			id: noteUrl,
			type: "Note",
			attributedTo: actorUrl,
			content: processedContent,
			to: ["https://www.w3.org/ns/activitystreams#Public"],
			published: new Date().toISOString()
		}
	};
}
