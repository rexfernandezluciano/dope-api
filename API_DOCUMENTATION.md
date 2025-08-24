# DOPE Network API Documentation

## Table of Contents
- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [OAuth 2.0](#oauth-20-endpoints)
  - [Users](#user-endpoints)
  - [Posts](#post-endpoints)
  - [Comments](#comment-endpoints)
  - [Replies](#reply-endpoints)
  - [Likes](#like-endpoints)
  - [Polls](#poll-endpoints)
  - [Images](#image-endpoints)
  - [Sessions](#session-endpoints)
  - [Content Moderation](#content-moderation-endpoints)
  - [Reports](#report-endpoints)
  - [Blocks](#block-endpoints)
  - [Recommendations](#recommendation-endpoints)
  - [Analytics](#analytics-endpoints)
  - [Business/Advertising](#business-endpoints)
  - [Credits](#credits-endpoints)
  - [Payments](#payment-endpoints)
  - [User Subscriptions](#user-subscriptions-endpoints)
  - [ActivityPub Federation](#activitypub-endpoints)
  - [Well-Known](#well-known-endpoints)
- [Data Models](#data-models)
- [Subscription Tiers](#subscription-tiers)

## Overview

The DOPE Network API is a comprehensive social media platform API built with Node.js, Express, TypeScript, and Prisma. It supports user profiles, posts, comments, social interactions, content moderation, payments, live streaming, and ActivityPub federation.

## Base URL

```
Production: https://api.dopp.eu.org
Development: http://localhost:5000
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Some endpoints also support OAuth 2.0 authentication for third-party applications.

## Rate Limiting

- Authentication endpoints: 5 requests per minute
- General endpoints: 100 requests per minute
- File upload endpoints: 10 requests per minute
- Content moderation: 50 requests per minute

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human readable error message",
  "details": [] // Additional error details for validation errors
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid session or token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `500` - Internal Server Error

---

## API Endpoints

### Authentication Endpoints

#### Register User
```http
POST /v1/auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "password": "password123",
  "photoURL": "https://example.com/photo.jpg",
  "gender": "male",
  "birthday": "1990-01-01T00:00:00.000Z",
  "subscription": "free",
  "privacy": {
    "profile": "public",
    "comments": "public",
    "sharing": true,
    "chat": "public"
  }
}
```

**Required Fields:**
- `name`: User's display name
- `email`: Valid email address
- `username`: Unique username (3+ characters)
- `password`: Password (6+ characters)

**Optional Fields:**
- `photoURL`: Profile picture URL
- `gender`: One of "male", "female", "non_binary", "prefer_not_to_say"
- `birthday`: ISO 8601 datetime string
- `subscription`: Subscription tier ("free", "premium", "pro") - defaults to "free"
- `privacy`: Privacy settings object with profile, comments, sharing, and chat preferences

**Response (201):**
```json
{
  "message": "Registered. Check your email for the verification code.",
  "verificationId": "verification_uuid",
  "uid": "user_id"
}
```

**Error Responses:**
- `409`: Email already registered
- `400`: Username already taken or invalid format

#### Check Username Availability
```http
POST /v1/auth/check-username
```

**Request Body:**
```json
{
  "username": "johndoe"
}
```

**Response (200):**
```json
{
  "available": true,
  "message": "Username is available"
}
```

#### Check Email Availability
```http
POST /v1/auth/check-email
```

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "available": false,
  "message": "Email is already registered"
}
```

#### Verify Email
```http
POST /v1/auth/verify-email
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "code": "123456",
  "verificationId": "verification_id_here"
}
```

**Response (200):**
```json
{
  "message": "Email verified successfully"
}
```

#### Resend Verification Code
```http
POST /v1/auth/resend-code
```

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "message": "Verification code resent",
  "verificationId": "new_verification_id"
}
```

#### Login
```http
POST /v1/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "token": "jwt_token",
  "sessionId": "session_id",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "bio": "User bio",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false,
    "membership": {
      "subscription": "free",
      "nextBillingDate": "2024-12-15T10:30:00Z"
    },
    "privacy": {
      "profile": "public",
      "comments": "public",
      "sharing": true,
      "chat": "public"
    },
    "hasVerifiedEmail": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Google OAuth Login
```http
POST /v1/auth/google
```

**Request Body:**
```json
{
  "token": "google_id_token"
}
```

**Response (200):**
```json
{
  "token": "jwt_token",
  "sessionId": "session_id",
  "user": { /* same as login response */ }
}
```

#### Google OAuth Callback
```http
GET /v1/auth/google/callback
```

Redirects to frontend with query parameters: `token`, `sessionId`, `uid`

#### Get Current User
```http
GET /v1/auth/me
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "status": "ok",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "bio": "User bio",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false,
    "membership": {
      "subscription": "premium",
      "nextBillingDate": "2025-12-12T06:09:00.000Z"
    },
    "stats": {
      "posts": 9,
      "followers": 23,
      "followings": 1,
      "likes": 127
    },
    "privacy": {
      "profile": "public",
      "comments": "public",
      "sharing": true,
      "chat": "public"
    },
    "hasVerifiedEmail": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Forgot Password
```http
POST /v1/auth/forgot-password
```

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "message": "If your email is registered, you will receive a password reset code shortly.",
  "resetId": "reset_id_here"
}
```

**Response (400) - Social Login Account:**
```json
{
  "message": "This account uses social login. Please sign in with your social account."
}
```

#### Reset Password
```http
POST /v1/auth/reset-password
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "code": "123456",
  "resetId": "reset_id_here",
  "newPassword": "newPassword123"
}
```

**Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

**Error Responses:**
- `400`: Invalid reset request, expired code, or incorrect code
- `404`: User not found

#### Validate Reset ID
```http
GET /v1/auth/validate-reset-id/:resetId
```

**Response (200):**
```json
{
  "message": "Reset ID is valid",
  "email": "john@example.com"
}
```

**Error Responses:**
- `400`: Reset ID is required or expired
- `404`: Reset ID not found

#### Logout
```http
POST /v1/auth/logout
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

#### Validate Verification ID
```http
GET /v1/auth/validate/:verificationId
```

**Response (200):**
```json
{
  "message": "Verification ID is valid",
  "email": "john@example.com"
}
```

---

### OAuth 2.0 Endpoints

#### Register OAuth Application
```http
POST /v1/oauth/register
```

**Request Body:**
```json
{
  "client_name": "My Fediverse App",
  "redirect_uris": ["https://myapp.com/callback"],
  "scopes": "read write follow",
  "website": "https://myapp.com"
}
```

**Response (201):**
```json
{
  "id": "app_id",
  "name": "My Fediverse App",
  "website": "https://myapp.com",
  "redirect_uri": "https://myapp.com/callback",
  "client_id": "client_id",
  "client_secret": "client_secret",
  "vapid_key": ""
}
```

#### OAuth Authorization
```http
GET /v1/oauth/authorize?response_type=code&client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&scope=SCOPE&state=STATE
```

**Query Parameters:**
- `response_type`: Must be "code"
- `client_id`: OAuth application client ID
- `redirect_uri`: Registered redirect URI
- `scope`: Requested permissions (read, write, follow)
- `state`: CSRF protection token
- `code_challenge`: PKCE challenge (optional)
- `code_challenge_method`: PKCE method (optional)

**Response:**
Redirects to `redirect_uri` with authorization code

#### OAuth Token Exchange
```http
POST /v1/oauth/token
```

**Request Body:**
```json
{
  "grant_type": "authorization_code",
  "code": "authorization_code",
  "redirect_uri": "https://myapp.com/callback",
  "client_id": "client_id",
  "client_secret": "client_secret",
  "code_verifier": "pkce_verifier"
}
```

**Response (200):**
```json
{
  "access_token": "access_token",
  "token_type": "Bearer",
  "expires_in": 7200,
  "refresh_token": "refresh_token",
  "scope": "read write",
  "created_at": 1642234567
}
```

#### Revoke OAuth Token
```http
POST /v1/oauth/revoke
```

**Request Body:**
```json
{
  "token": "access_token_or_refresh_token",
  "token_type_hint": "access_token"
}
```

**Response (200):**
```json
{}
```

#### Get OAuth User Info
```http
GET /v1/oauth/userinfo
Authorization: Bearer <oauth_access_token>
```

**Response (200):**
```json
{
  "id": "user_id",
  "username": "johndoe",
  "display_name": "John Doe",
  "note": "User bio",
  "avatar": "https://example.com/avatar.jpg",
  "created_at": "2024-01-15T10:30:00Z",
  "verified": true,
  "url": "https://api.dopp.eu.org/@johndoe"
}
```

#### Get User's OAuth Applications
```http
GET /v1/oauth/my-apps
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "applications": [
    {
      "id": "app_id",
      "name": "My App",
      "clientId": "client_id",
      "redirectUris": ["https://myapp.com/callback"],
      "scopes": "read write follow",
      "website": "https://myapp.com",
      "createdAt": "2024-01-15T10:30:00Z",
      "activeTokens": 3
    }
  ]
}
```

#### Get User's Granted Authorizations
```http
GET /v1/oauth/my-authorizations
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "authorizations": [
    {
      "id": "auth_id",
      "application": {
        "id": "app_id",
        "name": "Third Party App",
        "website": "https://thirdparty.com"
      },
      "scope": "read write",
      "createdAt": "2024-01-15T10:30:00Z",
      "expiresAt": "2024-01-16T10:30:00Z"
    }
  ]
}
```

#### Revoke Authorization
```http
DELETE /v1/oauth/authorizations/:authorizationId
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Authorization revoked successfully"
}
```

#### Delete OAuth Application
```http
DELETE /v1/oauth/apps/:appId
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Application deleted successfully"
}
```

---

### User Endpoints

#### Get All Users
```http
GET /v1/users
```

**Query Parameters:**
- `limit`: Number of users (default: 20, max: 100)
- `cursor`: Pagination cursor
- `search`: Search by username or name
- `subscription`: Filter by subscription type
- `hasBlueCheck`: Filter by verification status
- `sortBy`: Sort field (default: "createdAt")
- `sortOrder`: Sort direction (default: "desc")

**Response (200):**
```json
{
  "status": "ok",
  "users": [
    {
      "uid": "user_id",
      "name": "John Doe",
      "username": "johndoe",
      "bio": "User bio",
      "photoURL": "https://example.com/photo.jpg",
      "hasBlueCheck": false,
      "membership": {
        "subscription": "free"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "stats": {
        "posts": 42,
        "followers": 150,
        "following": 75
      },
      "isFollowedByCurrentUser": false
    }
  ],
  "nextCursor": "cursor_string",
  "hasMore": true,
  "limit": 20
}
```

#### Get User by Username
```http
GET /v1/users/:username
```

**Response (200):**
```json
{
  "status": "ok",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "bio": "User bio",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false,
    "membership": {
      "subscription": "premium"
    },
    "isBlocked": false,
    "isRestricted": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "posts": [
      {
        "id": "post_id",
        "content": "Hello world! #trending @mention",
        "imageUrls": ["https://example.com/image.jpg"],
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z",
        "stats": {
          "comments": 5,
          "likes": 25,
          "views": 150,
          "shares": 3,
          "clicks": 10
        },
        "postType": "text",
        "liveVideoUrl": null,
        "privacy": "public",
        "hashtags": ["trending"],
        "mentions": ["mention"],
        "author": {
          "uid": "user_id",
          "name": "John Doe",
          "username": "johndoe",
          "photoURL": "https://example.com/photo.jpg",
          "hasBlueCheck": false
        }
      }
    ],
    "stats": {
      "posts": 42,
      "followers": 150,
      "following": 75
    },
    "isFollowedByCurrentUser": false,
    "isBlockedByCurrentUser": false,
    "isRestrictedByCurrentUser": false
  }
}
```

#### Update User Profile
```http
PUT /v1/users/:username
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "bio": "Updated bio",
  "photoURL": "https://example.com/new-photo.jpg",
  "gender": "male",
  "birthday": "1990-01-01T00:00:00.000Z",
  "federatedDiscoverable": true,
  "privacy": {
    "profile": "private",
    "comments": "followers",
    "sharing": false,
    "chat": "private"
  }
}
```

**Response (200):**
```json
{
  "uid": "user_id",
  "name": "Updated Name",
  "username": "johndoe",
  "bio": "Updated bio",
  "photoURL": "https://example.com/new-photo.jpg",
  "hasBlueCheck": false,
  "subscription": "premium",
  "privacy": {
    "profile": "private",
    "comments": "followers",
    "sharing": false,
    "chat": "private"
  },
  "hasVerifiedEmail": true
}
```

#### Follow/Unfollow User
```http
POST /v1/users/:username/follow
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "User followed",
  "following": true
}
```

#### Get User Followers
```http
GET /v1/users/:username/followers
```

**Response (200):**
```json
{
  "status": "ok",
  "followers": [
    {
      "uid": "follower_id",
      "name": "Follower Name",
      "username": "follower_username",
      "photoURL": "https://example.com/follower.jpg",
      "hasBlueCheck": false
    }
  ]
}
```

#### Get User Following
```http
GET /v1/users/:username/following
```

**Response (200):**
```json
{
  "status": "ok",
  "following": [
    {
      "uid": "following_id",
      "name": "Following Name",
      "username": "following_username",
      "photoURL": "https://example.com/following.jpg",
      "hasBlueCheck": false
    }
  ]
}
```

#### Upload Profile Picture
```http
POST /v1/users/profile-picture
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "photoURL": "https://example.com/new-profile-picture.jpg"
}
```

**Response (200):**
```json
{
  "message": "Profile picture updated successfully",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "photoURL": "https://example.com/new-profile-picture.jpg"
  }
}
```

#### Get User Total Earnings
```http
GET /v1/users/analytics/earnings
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Total earnings fetched successfully",
  "totalEarnings": 1.50,
  "totalEarningsInCents": 150
}
```

---

### Post Endpoints

#### Get Posts Feed
```http
GET /v1/posts
```

**Query Parameters:**
- `limit`: Number of posts (default: 20, max: 100)
- `cursor`: Pagination cursor
- `author`: Filter by username
- `postType`: "text" or "live_video"
- `hasImages`: "true" or "false"
- `hasLiveVideo`: "true" or "false"
- `search`: Search term
- `random`: "true" for randomized feed
- `quality`: "true" for high-quality content

**Note:** For authenticated users, the feed algorithm automatically prioritizes posts from users with similar age ranges and gender preferences based on the user's profile information.

**Response (200):**
```json
{
  "status": "ok",
  "posts": [
    {
      "id": "post_id",
      "content": "Hello world! #trending @mention",
      "imageUrls": ["https://example.com/image.jpg"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "stats": {
        "comments": 5,
        "likes": 25,
        "views": 100,
        "shares": 2,
        "clicks": 10
      },
      "author": {
        "uid": "user_id",
        "name": "John Doe",
        "username": "johndoe",
        "photoURL": "https://example.com/photo.jpg",
        "hasBlueCheck": false,
        "isFollowedByCurrentUser": false
      },
      "comments": [
        {
          "id": "comment_id",
          "content": "Great post!",
          "createdAt": "2024-01-15T10:35:00Z",
          "author": {
            "uid": "commenter_id",
            "name": "Commenter",
            "username": "commenter_username",
            "photoURL": "https://example.com/commenter.jpg",
            "hasBlueCheck": false
          }
        }
      ],
      "likes": [
        {
          "user": {
            "uid": "liker_id",
            "username": "liker_username"
          }
        }
      ],
      "postType": "text",
      "liveVideoUrl": null,
      "privacy": "public",
      "hashtags": ["trending"],
      "mentions": ["mention"],
      "moderationStatus": "approved",
      "poll": {
        "id": "poll_id",
        "question": "What's your favorite color?",
        "expiresAt": "2024-01-20T10:30:00Z",
        "allowMultiple": false,
        "isExpired": false,
        "totalVotes": 150,
        "options": [
          {
            "id": "option_id_1",
            "text": "Blue",
            "position": 0,
            "votes": 75,
            "percentage": 50,
            "isUserChoice": true
          },
          {
            "id": "option_id_2",
            "text": "Red",
            "position": 1,
            "votes": 75,
            "percentage": 50,
            "isUserChoice": false
          }
        ],
        "hasUserVoted": true
      }
    }
  ],
  "nextCursor": "cursor_string",
  "hasMore": true,
  "limit": 20
}
```

#### Create Post
```http
POST /v1/posts
Authorization: Bearer <jwt_token>
```

**Request Body (Text/Image Post):**
```json
{
  "content": "Hello world! #trending @mention",
  "imageUrls": ["https://example.com/image.jpg"],
  "postType": "text",
  "privacy": "public"
}
```

**Request Body (Live Video Post):**
```json
{
  "liveVideoUrl": "https://example.com/live-stream.m3u8",
  "postType": "live_video",
  "privacy": "public"
}
```

**Request Body (Poll Post):**
```json
{
  "content": "What's your favorite programming language?",
  "postType": "poll",
  "privacy": "public",
  "poll": {
    "question": "What's your favorite programming language?",
    "options": [
      {"text": "JavaScript"},
      {"text": "Python"},
      {"text": "TypeScript"},
      {"text": "Go"}
    ],
    "expiresIn": 1440,
    "allowMultiple": false
  }
}
```

**Response (201):**
```json
{
  "id": "post_id",
  "content": "Hello world! #trending @mention",
  "imageUrls": ["https://example.com/image.jpg"],
  "liveVideoUrl": "https://example.com/live-stream.m3u8",
  "postType": "live_video",
  "privacy": "public",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "authorId": "user_id",
  "hashtags": ["trending"],
  "mentions": ["mention"],
  "moderationStatus": "pending",
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false
  },
  "_count": {
    "comments": 0,
    "likes": 0
  }
}
```

#### Get Single Post
```http
GET /v1/posts/:id
```

**Response (200):**
```json
{
  "status": "ok",
  "post": {
    "id": "post_id",
    "content": "Hello world!",
    "imageUrls": ["https://example.com/image.jpg"],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "stats": {
      "comments": 5,
      "likes": 25,
      "views": 100,
      "shares": 2
    },
    "author": {
      "uid": "user_id",
      "name": "John Doe",
      "username": "johndoe",
      "photoURL": "https://example.com/photo.jpg",
      "hasBlueCheck": false
    },
    "postType": "text",
    "privacy": "public",
    "hashtags": ["trending"],
    "mentions": ["mention"],
    "moderationStatus": "approved",
    "poll": {
      "id": "poll_id",
      "question": "What's your favorite color?",
      "expiresAt": "2024-01-20T10:30:00Z",
      "allowMultiple": false,
      "isExpired": false,
      "totalVotes": 150,
      "options": [
        {
          "id": "option_id_1",
          "text": "Blue",
          "position": 0,
          "votes": 75,
          "percentage": 50,
          "isUserChoice": true
        },
        {
          "id": "option_id_2",
          "text": "Red",
          "position": 1,
          "votes": 75,
          "percentage": 50,
          "isUserChoice": false
        }
      ],
      "hasUserVoted": true
    }
  }
}
```

#### Like Post
```http
POST /v1/posts/:postId/like
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Post liked successfully"
}
```

#### Get Post Likes
```http
GET /v1/posts/:postId/likes
```

**Query Parameters:**
- `limit`: Number of likes (default: 20, max: 100)
- `cursor`: Pagination cursor

**Response (200):**
```json
{
  "likes": [
    {
      "id": "like_id",
      "createdAt": "2024-01-15T10:30:00Z",
      "user": {
        "uid": "user_id",
        "name": "John Doe",
        "username": "johndoe",
        "photoURL": "https://example.com/photo.jpg",
        "hasBlueCheck": false
      }
    }
  ],
  "nextCursor": null,
  "hasMore": false,
  "limit": 20
}
```

#### Share Post
```http
POST /v1/posts/share/:id
```

**Response (200):**
```json
{
  "message": "Post shared successfully"
}
```

#### Track Post View
```http
POST /v1/posts/:id/view
```

**Response (200):**
```json
{
  "message": "View tracked and earnings updated"
}
```

#### Update Post Engagement
```http
POST /v1/posts/:id/engagement
```

**Request Body:**
```json
{
  "action": "share"
}
```

**Response (200):**
```json
{
  "message": "share tracked and earnings updated",
  "earnings": 0.001
}
```

#### Delete Post
```http
DELETE /v1/posts/:id
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Post deleted successfully"
}
```

---

### Poll Endpoints

#### Vote on Poll
```http
POST /v1/polls/:pollId/vote
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "optionIds": ["option_id_1", "option_id_2"]
}
```

**Response (200):**
```json
{
  "message": "Vote recorded successfully",
  "votes": [
    {
      "id": "vote_id_1",
      "pollId": "poll_id",
      "optionId": "option_id_1",
      "userId": "user_id",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Error Responses:**
- `400`: Poll expired, already voted, or invalid options
- `404`: Poll not found

#### Get Poll Results
```http
GET /v1/polls/:pollId/results
```

**Response (200):**
```json
{
  "poll": {
    "id": "poll_id",
    "question": "What's your favorite color?",
    "expiresAt": "2024-01-20T10:30:00Z",
    "allowMultiple": false,
    "totalVotes": 150,
    "isExpired": false
  },
  "results": [
    {
      "id": "option_id_1",
      "text": "Blue",
      "position": 0,
      "votes": 75,
      "percentage": 50
    },
    {
      "id": "option_id_2",
      "text": "Red",
      "position": 1,
      "votes": 75,
      "percentage": 50
    }
  ]
}
```

#### Get User's Poll Vote
```http
GET /v1/polls/:pollId/user-vote
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "hasVoted": true,
  "votes": [
    {
      "optionId": "option_id_1",
      "optionText": "Blue",
      "votedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### Comment Endpoints

#### Get Comments for Post
```http
GET /v1/comments/post/:postId
```

**Query Parameters:**
- `limit`: Number of comments (default: 20, max: 100)
- `cursor`: Pagination cursor
- `author`: Filter by username
- `search`: Search term
- `sortBy`: "desc" or "asc" (default: "desc")

**Response (200):**
```json
{
  "comments": [
    {
      "id": "comment_id",
      "content": "Great post! #awesome @user",
      "createdAt": "2024-01-15T10:35:00Z",
      "updatedAt": "2024-01-15T10:35:00Z",
      "postId": "post_id",
      "authorId": "user_id",
      "hashtags": ["awesome"],
      "mentions": ["user"],
      "author": {
        "uid": "user_id",
        "name": "John Doe",
        "username": "johndoe",
        "photoURL": "https://example.com/photo.jpg",
        "hasBlueCheck": false
      },
      "replies": [
        {
          "id": "reply_id",
          "content": "Thanks!",
          "createdAt": "2024-01-15T10:40:00Z",
          "author": {
            "uid": "author_id",
            "name": "Author",
            "username": "author_username",
            "photoURL": "https://example.com/author.jpg",
            "hasBlueCheck": true
          }
        }
      ]
    }
  ],
  "nextCursor": "cursor_string",
  "hasMore": true,
  "limit": 20,
  "sortBy": "desc"
}
```

#### Search Comments Globally
```http
GET /v1/comments/search
```

**Query Parameters:**
- `query`: Search term (required)
- `limit`: Number of comments (default: 20, max: 100)
- `cursor`: Pagination cursor
- `author`: Filter by username
- `postId`: Filter by specific post
- `sortBy`: "desc" or "asc" (default: "desc")

**Response (200):**
```json
{
  "comments": [
    {
      "id": "comment_id",
      "content": "Great post! #awesome @user",
      "createdAt": "2024-01-15T10:35:00Z",
      "updatedAt": "2024-01-15T10:35:00Z",
      "postId": "post_id",
      "authorId": "user_id",
      "hashtags": ["awesome"],
      "mentions": ["user"],
      "author": {
        "uid": "user_id",
        "name": "John Doe",
        "username": "johndoe",
        "photoURL": "https://example.com/photo.jpg",
        "hasBlueCheck": false
      },
      "post": {
        "id": "post_id",
        "content": "Original post content",
        "postType": "text",
        "author": {
          "uid": "post_author_id",
          "name": "Post Author",
          "username": "post_author",
          "photoURL": "https://example.com/post_author.jpg",
          "hasBlueCheck": false
        }
      }
    }
  ],
  "nextCursor": "cursor_string",
  "hasMore": true,
  "limit": 20,
  "sortBy": "desc"
}
```

#### Create Comment
```http
POST /v1/comments/post/:postId
Authorization: Bearer <jwt_token>
```

**Request Body (Simple Comment):**
```json
{
  "content": "Great post! #awesome @user"
}
```

**Request Body (Comment with Tip):**
```json
{
  "content": "Great post! Here's a tip!",
  "tipAmount": 500,
  "stickerId": "sticker_123"
}
```

**Request Body (Comment with Donation):**
```json
{
  "content": "Love your content! Here's a donation!",
  "donationAmount": 1000,
  "isAnonymous": false
}
```

**Response (201):**
```json
{
  "id": "comment_id",
  "content": "Great post! #awesome @user",
  "createdAt": "2024-01-15T10:35:00Z",
  "updatedAt": "2024-01-15T10:35:00Z",
  "postId": "post_id",
  "authorId": "user_id",
  "hashtags": ["awesome"],
  "mentions": ["user"],
  "tipAmount": 500,
  "donationAmount": null,
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false
  },
  "payment": {
    "type": "tip",
    "status": "completed",
    "amount": 500,
    "tipId": "tip_123",
    "remainingCredits": 9500
  }
}
```

#### Update Comment
```http
PUT /v1/comments/:id
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "content": "Updated comment"
}
```

**Response (200):**
```json
{
  "id": "comment_id",
  "content": "Updated comment",
  "createdAt": "2024-01-15T10:35:00Z",
  "updatedAt": "2024-01-15T11:00:00Z",
  "postId": "post_id",
  "authorId": "user_id",
  "hashtags": [],
  "mentions": [],
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false
  }
}
```

#### Delete Comment
```http
DELETE /v1/comments/:id
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Comment deleted successfully"
}
```

---

### Reply Endpoints

#### Create Reply
```http
POST /v1/replies/comment/:commentId
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "content": "This is a reply to the comment"
}
```

**Response (201):**
```json
{
  "id": "reply_id",
  "content": "This is a reply to the comment",
  "createdAt": "2024-01-15T10:40:00Z",
  "updatedAt": "2024-01-15T10:40:00Z",
  "postId": "post_id",
  "parentId": "comment_id",
  "authorId": "user_id",
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false
  },
  "_count": {
    "likes": 0,
    "replies": 0
  }
}
```

#### Get Comment Replies
```http
GET /v1/replies/comment/:commentId
```

**Query Parameters:**
- `limit`: Number of replies (default: 20, max: 100)
- `cursor`: Pagination cursor
- `sortBy`: "desc" or "asc" (default: "desc")

**Response (200):**
```json
{
  "replies": [
    {
      "id": "reply_id",
      "content": "This is a reply to the comment",
      "createdAt": "2024-01-15T10:40:00Z",
      "updatedAt": "2024-01-15T10:40:00Z",
      "author": {
        "uid": "user_id",
        "name": "John Doe",
        "username": "johndoe",
        "photoURL": "https://example.com/photo.jpg",
        "hasBlueCheck": false
      },
      "likes": [
        {
          "user": {
            "uid": "user_id",
            "username": "johndoe"
          }
        }
      ],
      "stats": {
        "likes": 1,
        "replies": 0
      }
    }
  ],
  "nextCursor": "cursor_value",
  "hasMore": true,
  "limit": 20
}
```

#### Update Reply
```http
PUT /v1/replies/:id
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "content": "Updated reply content"
}
```

**Response (200):**
```json
{
  "id": "reply_id",
  "content": "Updated reply content",
  "createdAt": "2024-01-15T10:40:00Z",
  "updatedAt": "2024-01-15T11:00:00Z",
  "commentId": "comment_id",
  "authorId": "user_id",
  "hashtags": [],
  "mentions": [],
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false
  }
}
```

#### Delete Reply
```http
DELETE /v1/replies/:id
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Reply deleted successfully"
}
```

---

### Like Endpoints

#### Like/Unlike Comment
```http
POST /v1/comments/:commentId/like
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Comment liked",
  "liked": true
}
```

#### Get Comment Likes
```http
GET /v1/comments/:commentId/likes
```

**Query Parameters:**
- `limit`: Number of likes (default: 20, max: 100)
- `cursor`: Pagination cursor

**Response (200):**
```json
{
  "likes": [
    {
      "id": "like_id",
      "createdAt": "2024-01-15T10:30:00Z",
      "user": {
        "uid": "user_id",
        "name": "John Doe",
        "username": "johndoe",
        "photoURL": "https://example.com/photo.jpg",
        "hasBlueCheck": false
      }
    }
  ],
  "nextCursor": null,
  "hasMore": false,
  "limit": 20
}
```

#### Like/Unlike Reply
```http
POST /v1/likes/reply/:replyId
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Reply liked",
  "liked": true
}
```

---

### Image Endpoints

#### Upload Images
```http
POST /v1/images/upload
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Form Data:**
- `images`: File[] (up to 10 image files, max 10MB each)

**Response (200):**
```json
{
  "success": true,
  "imageUrls": [
    "https://res.cloudinary.com/your-cloud/image/upload/v1642234567/posts/image1.jpg",
    "https://res.cloudinary.com/your-cloud/image/upload/v1642234567/posts/image2.jpg"
  ]
}
```

**Error Response (400):**
```json
{
  "error": "No images provided"
}
```

---

### Session Endpoints

#### Get User Sessions
```http
GET /v1/sessions
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "sessions": [
    {
      "id": "session_id",
      "device": "iPhone 15 Pro",
      "browser": "Chrome",
      "ipAddress": "192.168.1.1",
      "location": "New York, US",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "expiresAt": "2024-01-16T10:30:00Z"
    }
  ]
}
```

#### Revoke Session
```http
DELETE /v1/sessions/:sessionId
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Session revoked successfully"
}
```

#### Revoke All Sessions
```http
DELETE /v1/sessions
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "All other sessions revoked successfully",
  "revokedCount": 3
}
```

---

### Content Moderation Endpoints

#### Moderate Content with AI
```http
POST /v1/content/moderate
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "content": "Content to moderate",
  "type": "post"
}
```

**Response (200):**
```json
{
  "approved": true,
  "reason": null,
  "confidence": 0.95
}
```

**Blocked Content Response (200):**
```json
{
  "approved": false,
  "reason": "Contains inappropriate content",
  "confidence": 0.89
}
```

#### Check Image Sensitivity
```http
POST /v1/content/check-image
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "imageUrl": "https://example.com/image.jpg"
}
```

**Response (200):**
```json
{
  "safe": true,
  "reason": null,
  "confidence": 0.92
}
```

---

### Report Endpoints

#### Create Report
```http
POST /v1/reports
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "targetType": "post",
  "targetId": "post_id",
  "reason": "spam",
  "description": "This post contains spam content"
}
```

**Response (201):**
```json
{
  "message": "Report submitted successfully",
  "reportId": "report_id"
}
```

#### Get User Reports
```http
GET /v1/reports
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "reports": [
    {
      "id": "report_id",
      "targetType": "post",
      "targetId": "post_id",
      "reason": "spam",
      "description": "This post contains spam content",
      "status": "pending",
      "createdAt": "2024-01-15T10:30:00Z",
      "reporter": {
        "uid": "user_id",
        "username": "johndoe",
        "name": "John Doe"
      }
    }
  ]
}
```

---

### Block Endpoints

#### Block User
```http
POST /v1/blocks/user/:userId
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "User blocked successfully"
}
```

#### Unblock User
```http
DELETE /v1/blocks/user/:userId
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "User unblocked successfully"
}
```

#### Get Blocked Users
```http
GET /v1/blocks
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "blockedUsers": [
    {
      "id": "block_id",
      "blockedUserId": "blocked_user_id",
      "createdAt": "2024-01-15T10:30:00Z",
      "blockedUser": {
        "uid": "blocked_user_id",
        "username": "blocked_username",
        "name": "Blocked User",
        "photoURL": "https://example.com/blocked.jpg"
      }
    }
  ]
}
```

#### Restrict User
```http
POST /v1/blocks/restrict/:userId
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "reason": "harassment"
}
```

**Response (200):**
```json
{
  "message": "User restricted successfully"
}
```

#### Remove Restriction
```http
DELETE /v1/blocks/restrict/:userId
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "User restriction removed successfully"
}
```

---

### Recommendation Endpoints

#### Get User Recommendations
```http
GET /v1/recommendations
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `type`: "users" or "posts" (default: "users")
- `limit`: Number of recommendations (default: 10)

**Response (200):**
```json
{
  "recommendations": [
    {
      "uid": "user_id",
      "username": "recommended_user",
      "name": "Recommended User",
      "photoURL": "https://example.com/photo.jpg",
      "hasBlueCheck": true,
      "bio": "User bio",
      "followersCount": 1500,
      "postsCount": 25
    }
  ],
  "type": "users"
}
```

#### Get Trending Hashtags
```http
GET /v1/recommendations/trending
```

**Query Parameters:**
- `limit`: Number of hashtags (default: 10)

**Response (200):**
```json
{
  "trending": [
    {
      "tag": "technology",
      "count": 1250
    },
    {
      "tag": "lifestyle",
      "count": 980
    }
  ]
}
```

---

### Analytics Endpoints

#### Get User Analytics
```http
GET /v1/analytics/user
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `period`: "7d", "30d", or "90d" (default: "30d")

**Response (200):**
```json
{
  "period": "30 days",
  "overview": {
    "totalPosts": 15,
    "totalViews": 12500,
    "totalLikes": 890,
    "totalComments": 234,
    "totalShares": 67,
    "totalEarnings": 15.50,
    "currentFollowers": 1250,
    "followersGained": 45,
    "engagementRate": 9.52
  },
  "topPosts": [
    {
      "id": "post_id",
      "content": "This is my top performing post...",
      "views": 2500,
      "likes": 180,
      "comments": 45,
      "shares": 12,
      "earnings": 5.25,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Get Post Analytics
```http
GET /v1/analytics/post/:postId
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "post": {
    "id": "post_id",
    "content": "My awesome post content",
    "createdAt": "2024-01-15T10:30:00Z",
    "postType": "text"
  },
  "analytics": {
    "views": 2500,
    "likes": 180,
    "comments": 45,
    "shares": 12,
    "clicks": 67,
    "earnings": 5.25,
    "engagementRate": 9.48,
    "totalEngagement": 237
  },
  "hashtags": ["technology", "innovation"],
  "mentions": ["johndoe", "janesmith"]
}
```

#### Get Platform Analytics
```http
GET /v1/analytics/platform
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "platform": {
    "totalUsers": 10000,
    "activeUsers": 2500,
    "totalPosts": 50000,
    "recentPosts": 5000,
    "totalComments": 150000,
    "totalLikes": 500000,
    "totalViews": 2500000,
    "totalEarnings": 15000.50,
    "totalAdSpend": 25000.75
  },
  "growth": {
    "userGrowthRate": 25.0,
    "contentGrowthRate": 10.0
  }
}
```

---

### Business Endpoints

#### Create Ad Campaign
```http
POST /v1/business/campaigns
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "title": "Promote My Post",
  "description": "Campaign to promote my latest post",
  "targetType": "post",
  "targetId": "post_id",
  "budget": 50.00,
  "duration": 7,
  "adType": "promotion",
  "targetAudience": {
    "age": [18, 35],
    "interests": ["technology", "lifestyle"]
  }
}
```

**Response (201):**
```json
{
  "message": "Ad campaign created successfully",
  "campaign": {
    "id": "campaign_id",
    "title": "Promote My Post",
    "budget": 50.00,
    "status": "pending"
  }
}
```

**Error Responses:**
- `400`: Insufficient credits for campaign budget
- `404`: Target post/user not found

#### Get Ad Campaigns
```http
GET /v1/business/campaigns
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Number per page (default: 10)
- `status`: Filter by status

**Response (200):**
```json
{
  "campaigns": [
    {
      "id": "campaign_id",
      "title": "Promote My Post",
      "status": "active",
      "budget": 50.00,
      "spent": 25.50,
      "earnings": 12.75,
      "analytics": {
        "impressions": 5000,
        "clicks": 150,
        "conversions": 10
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

#### Track Ad Interaction
```http
POST /v1/business/track
```

**Request Body:**
```json
{
  "campaignId": "campaign_id",
  "action": "click",
  "userId": "viewer_user_id"
}
```

**Response (200):**
```json
{
  "message": "click tracked successfully",
  "cost": 0.1,
  "earnings": 0.05
}
```

#### Get Campaign Analytics
```http
GET /v1/business/campaigns/:campaignId/analytics
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "campaign": {
    "id": "campaign_id",
    "title": "Promote My Post",
    "status": "active",
    "budget": 50.00,
    "spent": 25.50,
    "earnings": 12.75
  },
  "analytics": {
    "impressions": 5000,
    "clicks": 150,
    "conversions": 10,
    "ctr": 3.0,
    "conversionRate": 6.67,
    "costPerClick": 0.17
  }
}
```

#### Get Business Dashboard
```http
GET /v1/business/dashboard
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "overview": {
    "totalCampaigns": 5,
    "activeCampaigns": 3,
    "totalSpent": 125.50,
    "totalEarnings": 62.75,
    "netProfit": -62.75
  },
  "analytics": {
    "totalImpressions": 25000,
    "totalClicks": 750,
    "totalConversions": 50,
    "averageCTR": 3.0
  }
}
```

---

### Credits Endpoints

#### Get User Credits
```http
GET /v1/credits
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "credits": 2500,
  "creditsDisplay": "₱25.00"
}
```

#### Get Credit Packages
```http
GET /v1/credits/packages
```

**Response (200):**
```json
{
  "packages": [
    {
      "amount": 500,
      "credits": 500,
      "bonus": 0,
      "popular": false,
      "description": "Starter pack for small campaigns",
      "totalCredits": 500,
      "priceInPHP": 5.00,
      "priceDisplay": "₱5.00"
    },
    {
      "amount": 1000,
      "credits": 1000,
      "bonus": 100,
      "popular": false,
      "description": "Good for medium campaigns",
      "totalCredits": 1100,
      "priceInPHP": 10.00,
      "priceDisplay": "₱10.00"
    },
    {
      "amount": 2500,
      "credits": 2500,
      "bonus": 375,
      "popular": true,
      "description": "Most popular package",
      "totalCredits": 2875,
      "priceInPHP": 25.00,
      "priceDisplay": "₱25.00"
    },
    {
      "amount": 5000,
      "credits": 5000,
      "bonus": 1000,
      "popular": false,
      "description": "Best value for large campaigns",
      "totalCredits": 6000,
      "priceInPHP": 50.00,
      "priceDisplay": "₱50.00"
    },
    {
      "amount": 10000,
      "credits": 10000,
      "bonus": 2500,
      "popular": false,
      "description": "Professional package",
      "totalCredits": 12500,
      "priceInPHP": 100.00,
      "priceDisplay": "₱100.00"
    }
  ]
}
```

#### Purchase Credits
```http
POST /v1/credits/purchase
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "amount": 2500,
  "paymentMethodId": "pm_123456789"
}
```

**Response (200):**
```json
{
  "message": "Credit purchase initiated - complete payment to add credits",
  "paymentIntentId": "pi_123456789",
  "provider": "paypal",
  "approveUrl": "https://paypal.com/approve/...",
  "amount": 2500,
  "currency": "PHP",
  "description": "Ad Campaign Credits - ₱25.00"
}
```

**Error Responses:**
- `400`: Invalid amount or payment method
- `404`: User or payment method not found

#### Credits PayPal Webhook
```http
POST /v1/credits/webhook/paypal
```

Handles PayPal webhook events for credit purchases.

---

### Payment Endpoints

#### Get Payment Providers
```http
GET /v1/payments/providers
```

**Response (200):**
```json
{
  "providers": ["PayPal"],
  "availableIn": "Philippines",
  "paymentMethods": [
    {
      "type": "paypal_card",
      "name": "Credit/Debit Card (PayPal)",
      "provider": "paypal",
      "supportedCards": ["Visa", "Mastercard", "American Express", "Discover"],
      "fees": "4.4% + ₱15",
      "processingTime": "Instant"
    },
    {
      "type": "paypal_wallet",
      "name": "PayPal Wallet",
      "provider": "paypal",
      "fees": "4.4% + ₱15",
      "processingTime": "Instant"
    }
  ],
  "membershipPlans": [
    {
      "type": "premium",
      "name": "Premium",
      "price": 560,
      "currency": "PHP",
      "interval": "month",
      "features": [
        "Ad-free experience",
        "Priority support",
        "Extended analytics",
        "Custom themes"
      ]
    },
    {
      "type": "pro",
      "name": "Pro",
      "price": 1120,
      "currency": "PHP",
      "interval": "month",
      "features": [
        "All Premium features",
        "Advanced analytics",
        "API access",
        "Custom branding",
        "Priority moderation"
      ]
    }
  ]
}
```

#### Add Payment Method
```http
POST /v1/payments/methods
Authorization: Bearer <jwt_token>
```

**Request Body (PayPal Card):**
```json
{
  "type": "paypal_card",
  "paypalPaymentMethodId": "pm_123456789",
  "last4": "1111",
  "expiryMonth": 12,
  "expiryYear": 2025,
  "holderName": "John Doe",
  "isDefault": true
}
```

**Request Body (PayPal Wallet):**
```json
{
  "type": "paypal_wallet",
  "paypalEmail": "john.doe@mail.com",
  "isDefault": false
}
```

**Response (201):**
```json
{
  "message": "Payment method added successfully",
  "paymentMethod": {
    "id": "pm_123456789",
    "type": "paypal_card",
    "provider": "paypal",
    "last4": "1111",
    "isDefault": true
  }
}
```

#### Get Payment Methods
```http
GET /v1/payments/methods
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "paymentMethods": [
    {
      "id": "pm_123456789",
      "type": "paypal_card",
      "provider": "paypal",
      "last4": "1111",
      "expiryMonth": 12,
      "expiryYear": 2025,
      "holderName": "John Doe",
      "paypalEmail": "user@example.com",
      "isDefault": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Delete Payment Method
```http
DELETE /v1/payments/methods/:paymentMethodId
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "message": "Payment method deleted successfully"
}
```

#### Purchase Membership
```http
POST /v1/payments/purchase-membership
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "subscription": "premium",
  "paymentMethodId": "pm_123456789"
}
```

**Response (200):**
```json
{
  "message": "Payment initiated - complete payment to activate subscription",
  "paymentIntentId": "pi_123456789",
  "provider": "paypal",
  "approveUrl": "https://paypal.com/approve/...",
  "amount": 56000,
  "currency": "PHP",
  "description": "Premium Subscription"
}
```

#### PayPal Webhook
```http
POST /v1/payments/webhook/paypal
```

Handles PayPal webhook events for payment processing.

---

### User Subscriptions Endpoints

#### Get Subscription Tiers
```http
GET /v1/subscriptions/tiers
```

**Response (200):**
```json
{
  "tiers": [
    {
      "tier": "basic",
      "name": "Basic",
      "price": 100,
      "currency": "PHP",
      "interval": "month",
      "description": "Basic subscription tier",
      "features": ["Basic access", "Community support"]
    },
    {
      "tier": "premium",
      "name": "Premium",
      "price": 300,
      "currency": "PHP",
      "interval": "month",
      "description": "Premium subscription tier",
      "features": ["Premium content", "Priority support", "Exclusive stickers"]
    },
    {
      "tier": "vip",
      "name": "VIP",
      "price": 500,
      "currency": "PHP",
      "interval": "month",
      "description": "VIP subscription tier",
      "features": ["All premium features", "VIP access", "Custom stickers", "Direct messaging"]
    }
  ]
}
```

#### Subscribe to User
```http
POST /v1/subscriptions/subscribe
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "creatorId": "user_id",
  "tier": "premium",
  "paymentMethodId": "pm_123456789"
}
```

**Response (200):**
```json
{
  "message": "Subscription initiated - complete payment to activate",
  "subscription": {
    "id": "sub_123",
    "creatorId": "user_id",
    "tier": "premium",
    "status": "pending"
  },
  "paymentIntentId": "pi_123456789",
  "approveUrl": "https://paypal.com/approve/..."
}
```

#### Send Tip to User
```http
POST /v1/subscriptions/tip
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "receiverId": "user_id",
  "amount": 500,
  "message": "Great content!",
  "postId": "post_id",
  "stickerId": "sticker_id"
}
```

**Response (200):**
```json
{
  "message": "Tip sent successfully",
  "tip": {
    "id": "tip_123",
    "amount": 500,
    "currency": "PHP",
    "receiver": {
      "username": "creator",
      "name": "Creator Name"
    },
    "sender": {
      "username": "sender"
    },
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "transaction": {
    "type": "credit_transfer",
    "status": "completed",
    "amount": 500,
    "remainingCredits": 9500
  }
}
```

#### Send Donation to User
```http
POST /v1/subscriptions/donate
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "receiverId": "user_id",
  "amount": 1000,
  "message": "Keep up the great work!",
  "isAnonymous": false
}
```

**Response (200):**
```json
{
  "message": "Donation sent successfully",
  "donation": {
    "id": "donation_123",
    "amount": 1000,
    "currency": "PHP",
    "receiver": {
      "username": "creator",
      "name": "Creator Name"
    },
    "isAnonymous": false,
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "transaction": {
    "type": "credit_transfer",
    "status": "completed",
    "amount": 1000,
    "remainingCredits": 9000
  }
}
```

#### Get User Subscriptions
```http
GET /v1/subscriptions/my-subscriptions
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "subscriptions": [
    {
      "id": "sub_123",
      "creator": {
        "uid": "creator_id",
        "username": "creator",
        "name": "Creator Name",
        "photoURL": "https://example.com/photo.jpg"
      },
      "tier": "premium",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z",
      "expiresAt": "2024-02-15T10:30:00Z"
    }
  ]
}
```

#### Get Creator Subscribers
```http
GET /v1/subscriptions/my-subscribers
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "subscribers": [
    {
      "id": "sub_123",
      "subscriber": {
        "uid": "user_id",
        "username": "subscriber",
        "name": "Subscriber Name",
        "photoURL": "https://example.com/photo.jpg"
      },
      "tier": "premium",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "stats": {
    "totalSubscribers": 150,
    "basicSubscribers": 50,
    "premiumSubscribers": 75,
    "vipSubscribers": 25,
    "monthlyRevenue": 45000
  }
}
```

#### Create Custom Sticker
```http
POST /v1/subscriptions/stickers
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "name": "My Custom Sticker",
  "imageUrl": "https://example.com/sticker.png",
  "price": 100,
  "category": "custom"
}
```

**Response (201):**
```json
{
  "message": "Sticker created successfully",
  "sticker": {
    "id": "sticker_123",
    "name": "My Custom Sticker",
    "imageUrl": "https://example.com/sticker.png",
    "price": 100,
    "category": "custom",
    "creator": {
      "uid": "user_id",
      "username": "creator"
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Get Stickers
```http
GET /v1/subscriptions/stickers
```

**Query Parameters:**
- `creatorId`: Filter by creator ID
- `category`: Filter by category (custom, emoji, animated, premium)
- `limit`: Number of stickers (default: 20)
- `cursor`: Pagination cursor

**Response (200):**
```json
{
  "stickers": [
    {
      "id": "sticker_123",
      "name": "My Custom Sticker",
      "imageUrl": "https://example.com/sticker.png",
      "price": 100,
      "category": "custom",
      "creator": {
        "uid": "user_id",
        "username": "creator",
        "name": "Creator Name"
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "nextCursor": "cursor_string",
  "hasMore": true
}
```

#### Create Subscription Perk
```http
POST /v1/subscriptions/perks
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "tier": "premium",
  "title": "Exclusive Content Access",
  "description": "Get access to premium content and early releases"
}
```

**Response (201):**
```json
{
  "message": "Subscription perk created successfully",
  "perk": {
    "id": "perk_123",
    "tier": "premium",
    "title": "Exclusive Content Access",
    "description": "Get access to premium content and early releases",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Get Subscription Perks
```http
GET /v1/subscriptions/perks/:creatorId
```

**Response (200):**
```json
{
  "perks": {
    "basic": [
      {
        "id": "perk_1",
        "tier": "basic",
        "title": "Basic Access",
        "description": "Access to basic content"
      }
    ],
    "premium": [
      {
        "id": "perk_2",
        "tier": "premium",
        "title": "Premium Content",
        "description": "Access to premium content and features"
      }
    ],
    "vip": [
      {
        "id": "perk_3",
        "tier": "vip",
        "title": "VIP Access",
        "description": "Full access to all content and features"
      }
    ]
  }
}
```

#### Subscription Webhook Handler
```http
POST /v1/subscriptions/webhook
```

Handles PayPal webhook events for subscription payments, tips, and donations.

---

### ActivityPub Endpoints

#### Get User Actor
```http
GET /activitypub/users/:username
Accept: application/activity+json
```

**Response (200):**
```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1"
  ],
  "id": "https://api.dopp.eu.org/activitypub/users/john",
  "type": "Person",
  "preferredUsername": "john",
  "name": "John Doe",
  "summary": "User bio here",
  "icon": {
    "type": "Image",
    "mediaType": "image/jpeg",
    "url": "https://example.com/avatar.jpg"
  },
  "inbox": "https://api.dopp.eu.org/activitypub/users/john/inbox",
  "outbox": "https://api.dopp.eu.org/activitypub/users/john/outbox",
  "followers": "https://api.dopp.eu.org/activitypub/users/john/followers",
  "following": "https://api.dopp.eu.org/activitypub/users/john/following",
  "publicKey": {
    "id": "https://api.dopp.eu.org/activitypub/users/john#main-key",
    "owner": "https://api.dopp.eu.org/activitypub/users/john",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n..."
  }
}
```

#### Get User Outbox
```http
GET /activitypub/users/:username/outbox
GET /activitypub/users/:username/outbox?page=1
Accept: application/activity+json
```

**Response (Collection Summary):**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://api.dopp.eu.org/activitypub/users/john/outbox",
  "type": "OrderedCollection",
  "totalItems": 42,
  "first": "https://api.dopp.eu.org/activitypub/users/john/outbox?page=1",
  "last": "https://api.dopp.eu.org/activitypub/users/john/outbox?page=3"
}
```

**Response (Paginated Posts):**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://api.dopp.eu.org/activitypub/users/john/outbox?page=1",
  "type": "OrderedCollectionPage",
  "partOf": "https://api.dopp.eu.org/activitypub/users/john/outbox",
  "totalItems": 42,
  "orderedItems": [
    {
      "id": "https://api.dopp.eu.org/posts/123/activity",
      "type": "Create",
      "actor": "https://api.dopp.eu.org/activitypub/users/john",
      "published": "2024-01-15T10:30:00Z",
      "object": {
        "id": "https://api.dopp.eu.org/posts/123",
        "type": "Note",
        "content": "Hello, fediverse!",
        "attributedTo": "https://api.dopp.eu.org/activitypub/users/john",
        "to": ["https://www.w3.org/ns/activitystreams#Public"],
        "published": "2024-01-15T10:30:00Z"
      }
    }
  ],
  "next": "https://api.dopp.eu.org/activitypub/users/john/outbox?page=2"
}
```

#### ActivityPub Inbox
```http
POST /activitypub/inbox
Content-Type: application/activity+json
Signature: keyId="...",algorithm="rsa-sha256",headers="...",signature="..."
```

**Follow Activity:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://mastodon.social/activities/123",
  "type": "Follow",
  "actor": "https://mastodon.social/users/alice",
  "object": "https://api.dopp.eu.org/activitypub/users/john"
}
```

**Response (200):**
```json
{
  "message": "Activity accepted"
}
```

#### Get User Followers
```http
GET /activitypub/users/:username/followers
Accept: application/activity+json
```

#### Get User Following
```http
GET /activitypub/users/:username/following
Accept: application/activity+json
```

#### Get User Featured Posts
```http
GET /activitypub/users/:username/featured
Accept: application/activity+json
```

#### Get Post Activity
```http
GET /activitypub/posts/:postId
Accept: application/activity+json
```

#### Get Post Activity Object
```http
GET /activitypub/posts/:postId/activity
Accept: application/activity+json
```

#### Get User Collections
```http
GET /activitypub/users/:username/liked
GET /activitypub/users/:username/shares
GET /activitypub/users/:username/likes
GET /activitypub/users/:username/blocked
GET /activitypub/users/:username/rejections
GET /activitypub/users/:username/rejected
Accept: application/activity+json
```

---

### Well-Known Endpoints

#### WebFinger Discovery
```http
GET /.well-known/webfinger?resource=acct:username@domain
```

**Query Parameters:**
- `resource`: Resource identifier in format `acct:username@domain`

**Response (200):**
```json
{
  "subject": "acct:john@api.dopp.eu.org",
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://api.dopp.eu.org/activitypub/users/john"
    }
  ]
}
```

#### Host Meta
```http
GET /.well-known/host-meta
```

**Response (200):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" type="application/xrd+xml" template="https://api.dopp.eu.org/.well-known/webfinger?resource={uri}"/>
</XRD>
```

#### NodeInfo Discovery
```http
GET /.well-known/nodeinfo
```

**Response (200):**
```json
{
  "links": [
    {
      "rel": "http://nodeinfo.diaspora.software/ns/schema/2.0",
      "href": "https://api.dopp.eu.org/.well-known/nodeinfo/2.0"
    }
  ]
}
```

#### NodeInfo 2.0
```http
GET /.well-known/nodeinfo/2.0
```

**Response (200):**
```json
{
  "version": "2.0",
  "software": {
    "name": "dope-network",
    "version": "1.0.0"
  },
  "protocols": ["activitypub"],
  "services": {
    "outbound": [],
    "inbound": []
  },
  "usage": {
    "users": {
      "total": 10000,
      "activeMonth": 2500,
      "activeHalfyear": 5000
    },
    "localPosts": 50000,
    "localComments": 150000
  },
  "openRegistrations": true,
  "metadata": {
    "nodeName": "DOPE Network",
    "nodeDescription": "A comprehensive social media platform"
  }
}
```

---

## Data Models

### User
```typescript
{
  uid: string;
  username: string;
  email: string;
  password: string;
  name?: string;
  bio?: string;
  photoURL?: string;
  gender?: "male" | "female" | "non_binary" | "prefer_not_to_say";
  birthday?: Date;
  subscription: "free" | "premium" | "pro";
  nextBillingDate?: Date;
  hasBlueCheck: boolean;
  credits: number; // Credits for ad campaigns in centavos
  privacy?: {
    profile: "public" | "private";
    comments: "public" | "followers" | "private";
    sharing: boolean;
    chat: "public" | "followers" | "private";
  };
  hasVerifiedEmail: boolean;
  isBlocked: boolean;
  isRestricted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Post
```typescript
{
  id: string;
  content?: string;
  imageUrls: string[];
  liveVideoUrl?: string;
  postType: "text" | "live_video" | "poll";
  privacy: "public" | "private" | "followers";
  hashtags: string[];
  mentions: string[];
  moderationStatus: "pending" | "approved" | "rejected";
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Comment
```typescript
{
  id: string;
  content: string;
  postId: string;
  authorId: string;
  hashtags: string[];
  mentions: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Reply
```typescript
{
  id: string;
  content: string;
  commentId: string;
  authorId: string;
  hashtags: string[];
  mentions: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Session
```typescript
{
  id: string;
  sid: string;
  userId: string;
  device?: string;
  browser?: string;
  ipAddress?: string;
  location?: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### OAuth Application
```typescript
{
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string;
  website?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### OAuth Access Token
```typescript
{
  id: string;
  token: string;
  refreshToken: string;
  applicationId: string;
  userId: string;
  scope: string;
  expiresAt: Date;
  createdAt: Date;
}
```

### Password Reset
```typescript
{
  resetId: string;
  email: string;
  code: string;
  expireAt: Date;
  createdAt: Date;
}
```

### Email Verification
```typescript
{
  verificationId: string;
  email: string;
  code: string;
  expireAt: Date;
}
```

### Poll
```typescript
{
  id: string;
  postId: string;
  question: string;
  expiresAt?: Date;
  allowMultiple: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Poll Option
```typescript
{
  id: string;
  pollId: string;
  text: string;
  position: number;
  createdAt: Date;
}
```

### Poll Vote
```typescript
{
  id: string;
  pollId: string;
  optionId: string;
  userId?: string;
  actorUrl?: string; // For federated votes
  activityId?: string; // For federated activities
  createdAt: Date;
}
```

### Payment Method
```typescript
{
  id: string;
  userId: string;
  type: "paypal_card" | "paypal_wallet";
  provider: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  holderName?: string;
  paypalEmail?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Report
```typescript
{
  id: string;
  reporterId: string;
  targetType: "post" | "comment" | "user";
  targetId: string;
  reason: "spam" | "harassment" | "inappropriate" | "violence" | "other";
  description?: string;
  status: "pending" | "reviewed" | "resolved";
  createdAt: Date;
  updatedAt: Date;
}
```

### Block
```typescript
{
  id: string;
  blockerId: string;
  blockedUserId: string;
  type: "block" | "restrict";
  reason?: string;
  createdAt: Date;
}
```

### Post Analytics
```typescript
{
  id: string;
  postId: string;
  views: number;
  shares: number;
  clicks: number;
  earnings: number; // stored in cents
  createdAt: Date;
  updatedAt: Date;
}
```

### Ad Campaign
```typescript
{
  id: string;
  title: string;
  description?: string;
  userId: string;
  targetType: "post" | "user";
  targetId: string;
  budget: number; // in cents
  spent: number; // in cents
  duration: number; // in days
  adType: "promotion" | "boost";
  status: "pending" | "active" | "paused" | "completed";
  targetAudience: object;
  createdAt: Date;
  updatedAt: Date;
}
```

### User Subscription
```typescript
{
  id: string;
  subscriberId: string;
  creatorId: string;
  tier: "basic" | "premium" | "vip";
  status: "active" | "cancelled" | "expired";
  paymentMethodId: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}
```

### Tip
```typescript
{
  id: string;
  senderId: string;
  receiverId: string;
  amount: number; // in centavos
  message?: string;
  postId?: string;
  stickerId?: string;
  createdAt: Date;
}
```

### Donation
```typescript
{
  id: string;
  senderId: string;
  receiverId: string;
  amount: number; // in centavos
  message?: string;
  isAnonymous: boolean;
  createdAt: Date;
}
```

### Custom Sticker
```typescript
{
  id: string;
  name: string;
  imageUrl: string;
  price: number; // in centavos
  category: "custom" | "emoji" | "animated" | "premium";
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Subscription Perk
```typescript
{
  id: string;
  creatorId: string;
  tier: "basic" | "premium" | "vip";
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Subscription Tiers

### Free Tier
- Basic features
- Limited posts per day
- Standard support
- Basic analytics

### Premium Tier (₱560 PHP/month)
- Ad-free experience
- Priority support
- Extended analytics
- Custom themes
- Blue check eligibility

### Pro Tier (₱1,120 PHP/month)
- All Premium features
- Advanced analytics
- API access
- Custom branding
- Priority moderation
- Enhanced monetization

---

## Federation Support

The DOPE Network API supports ActivityPub federation, enabling interoperability with Mastodon, Pleroma, and other fediverse platforms:

- **User Discovery**: WebFinger protocol for cross-instance user discovery
- **Content Federation**: Public posts are federated to follower instances
- **Social Interactions**: Receive and send follows, likes, and replies
- **HTTP Signatures**: Cryptographic verification of federated requests
- **Content Types**: Support for Note objects with text and images

---

## Environment Variables

Required environment variables for deployment:

```env
# Database
DATABASE_URL=your_database_url

# Authentication
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=638708

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email (Brevo SMTP)
BREVO_EMAIL_ADDRESS=your_email_address
BREVO_EMAIL_PASSWORD=your_email_password
EMAIL_FROM=noreply@dopp.eu.org

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Application
APP_NAME=DOPE Network
NODE_ENV=production
FRONTEND_URL=https://www.dopp.eu.org
CRON_SECRET=your_cron_secret

# AI Content Moderation
GOOGLE_AI_API_KEY=your_google_ai_api_key
```

---

## Deployment

The API is designed to be deployed on multiple platforms:

- **Vercel**: Serverless deployment with edge functions
- **Render**: Traditional server deployment
- **Replit**: Development and testing environment

See `vercel.json` and `render.yaml` for deployment configurations.

---

This documentation covers all endpoints and features of the DOPE Network API. For additional support or questions, please refer to the project repository or contact the development team.