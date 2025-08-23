
import { Router } from 'express';
import {
	webfinger,
	getActor,
	handleInbox,
	handleSharedInbox,
	getOutbox,
	getFollowers,
	getFollowing,
	getFeatured,
	getFeaturedTags,
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

// ActivityPub routes
router.get('/users/:username', activityPubContentNegotiation, asyncHandler(getActor));
router.post('/users/:username/inbox', asyncHandler(handleInbox));
router.post('/inbox', asyncHandler(handleSharedInbox)); // Shared inbox for efficiency
router.get('/users/:username/outbox', asyncHandler(getOutbox));
router.get('/users/:username/followers', asyncHandler(getFollowers));
router.get('/users/:username/following', asyncHandler(getFollowing));
router.get('/users/:username/collections/featured', asyncHandler(getFeatured));
router.get('/users/:username/collections/tags', asyncHandler(getFeaturedTags));

export default router;
