
import { Router } from 'express';
import {
	getActor,
	handleInbox,
	handleSharedInbox,
	getOutbox,
	getFollowers,
	getFollowing,
	getFeatured,
	getFeaturedTags,
	getPost,
	getPostActivity,
	getLiked,
	getCollection,
	getBlocked,
	getRejections,
	getRejected,
	getShares,
	getLikes,
} from '../controllers/activitypub.controller';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// Content negotiation middleware for ActivityPub
const activityPubContentNegotiation = (req: any, res: any, next: any) => {
	const accept = req.headers.accept || '';
	
	if (
		accept.includes('application/activity+json') ||
		accept.includes('application/ld+json') ||
		accept.includes('application/json')
	) {
		req.isActivityPub = true;
		// Set the response content type for ActivityPub
		res.setHeader('Content-Type', 'application/activity+json; charset=utf-8');
	}
	
	next();
};

// HTTP signature validation middleware (basic implementation)
const validateSignature = (req: any, res: any, next: any) => {
	const signature = req.headers.signature;
	const contentType = req.headers['content-type'];
	
	// Log incoming activity for debugging
	console.log(`Incoming ${req.method} ${req.url}`);
	console.log(`Content-Type: ${contentType}`);
	console.log(`Signature: ${signature ? 'present' : 'missing'}`);
	
	if (req.body && typeof req.body === 'object') {
		console.log(`Activity Type: ${req.body.type}`);
		console.log(`Actor: ${req.body.actor}`);
	}
	
	// For now, we'll be permissive but log signature validation
	if (!signature) {
		console.warn('No signature present in ActivityPub request');
	}
	
	next();
};

// ActivityPub routes
router.get('/users/:username', activityPubContentNegotiation, asyncHandler(getActor));
router.post('/users/:username/inbox', validateSignature, asyncHandler(handleInbox));
router.post('/inbox', validateSignature, asyncHandler(handleSharedInbox)); // Shared inbox for efficiency
router.get('/users/:username/outbox', asyncHandler(getOutbox));
router.get('/users/:username/followers', asyncHandler(getFollowers));
router.get('/users/:username/following', asyncHandler(getFollowing));
router.get('/users/:username/collections/featured', asyncHandler(getFeatured));
router.get('/users/:username/collections/tags', asyncHandler(getFeaturedTags));

// Additional routes for complete ActivityPub support
router.get('/posts/:id', asyncHandler(getPost));
router.get('/posts/:id/activity', asyncHandler(getPostActivity));
router.get('/users/:username/liked', asyncHandler(getLiked));
router.get('/users/:username/collections/:id', asyncHandler(getCollection));
router.get('/users/:username/blocked', asyncHandler(getBlocked));
router.get('/users/:username/rejections', asyncHandler(getRejections));
router.get('/users/:username/rejected', asyncHandler(getRejected));
router.get('/users/:username/shares', asyncHandler(getShares));
router.get('/users/:username/likes', asyncHandler(getLikes));

export default router;
