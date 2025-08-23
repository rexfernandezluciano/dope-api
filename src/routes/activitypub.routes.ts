
import { Router } from 'express';
import { webfinger, getActor, getOutbox, postInbox, getFollowers, getFollowing, getPost, getPostActivity } from '../controllers/activitypub.controller';
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

// WebFinger is now handled at root level in index.ts

// Actor endpoints
router.get('/users/:username', asyncHandler(getActor));
router.get('/users/:username/outbox', asyncHandler(getOutbox));
router.post('/users/:username/inbox', asyncHandler(postInbox));
router.get('/users/:username/followers', asyncHandler(getFollowers));
router.get('/users/:username/following', asyncHandler(getFollowing));

// Post endpoints
router.get('/posts/:postId', asyncHandler(getPost));
router.get('/posts/:postId/activity', asyncHandler(getPostActivity));

// Shared inbox for the instance
router.post('/inbox', asyncHandler(postInbox));

export default router;
