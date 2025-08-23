
import { Router } from 'express';
import { webfinger, getActor, getOutbox, postInbox } from '../controllers/activitypub.controller';
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

// WebFinger endpoint for user discovery
router.get('/.well-known/webfinger', asyncHandler(webfinger));

// Actor endpoints
router.get('/users/:username', asyncHandler(getActor));
router.get('/users/:username/outbox', asyncHandler(getOutbox));
router.post('/users/:username/inbox', asyncHandler(postInbox));

// Shared inbox for the instance
router.post('/inbox', asyncHandler(postInbox));

export default router;
