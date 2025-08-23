# DOPE Network API Documentation

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Authentication Routes](#authentication-routes)
  - [User Routes](#user-routes)
  - [Post Routes](#post-routes)
  - [Comment Routes](#comment-routes)
  - [Like Routes](#like-routes)
  - [Reply Routes](#reply-routes)
  - [Image Routes](#image-routes)
  - [Session Routes](#session-routes)
  - [Content Moderation Routes](#content-moderation-routes)
  - [Report Routes](#report-routes)
  - [Block Routes](#block-routes)
  - [Payment Routes](#payment-routes)
- [ActivityPub Routes](#activitypub-routes)
- [Data Models](#data-models)
- [Error Handling](#error-handling)

## Overview
A comprehensive social media API for the DOPE Network platform supporting user profiles, posts, comments, social interactions, content moderation, payments, and live streaming.

## Features
- User registration and authentication with email verification
- Enhanced session management with device and browser tracking
- Text and live video posts with image support
- Comments, likes, and replies system with nested threading
- User following system
- Content moderation with AI
- Hashtags and mentions support with automatic extraction
- Post sharing and engagement tracking
- User reporting and blocking system with restriction levels
- Payment methods and subscription management
- Live streaming support
- Image upload with Cloudinary integration
- Subscription tiers (Free, Premium, Pro) with automatic billing reminders
- Verified badges (Blue Check)
- Google OAuth integration
- Earnings tracking for creators with detailed analytics
- Global search functionality across posts and comments
- User blocking and restriction capabilities
- Automated billing reminder emails (3 days before renewal)

## Base URL
```
https://api.dopp.eu.org
```

## Authentication
The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### Authentication Routes

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
  "subscription": "free",
  "privacy": {
    "profile": "public",
    "comments": "public",
    "sharing": true,
    "chat": "public"
  }
}
```

**Success Response (201):**
```json
{
  "message": "Registered. Check your email for the verification code.",
  "verificationId": "verification_uuid",
  "uid": "user_id"
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

**Success Response (200):**
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

**Success Response (200):**
```json
{
  "message": "Verification code resent",
  "verificationId": "new_verification_id"
}
```

#### Login
```http
POST /v1/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200):**
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
      "subscription": "free"
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
Content-Type: application/json
```

**Request Body:**
```json
{
  "idToken": "google_id_token"
}
```

**Success Response (200):**
```json
{
  "token": "jwt_token",
  "sessionId": "session_id",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false,
    "membership": {
      "subscription": "free"
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

#### Google OAuth Callback
```http
GET /v1/auth/google/callback
```

**Response:**
Redirects to frontend at `/auth/google/callback` with query parameters:
- `token`: JWT authentication token
- `sessionId`: Session identifier
- `uid`: User ID

**Example redirect:**
```
https://www.dopp.eu.org/auth/google/callback?token=jwt_token&sessionId=session_id&uid=user_id
```

#### Logout
```http
POST /v1/auth/logout
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

#### Get Current User
```http
GET /v1/auth/me
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
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

### User Routes

#### Get All Users
```http
GET /v1/users
```

**Success Response (200):**
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
  ]
}
```

#### Get User by Username
```http
GET /v1/users/:username
```

**Success Response (200):**
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
          "shares": 3,
          "views": 150
        },
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
  "privacy": {
    "profile": "private",
    "comments": "followers",
    "sharing": false,
    "chat": "private"
  }
}
```

**Success Response (200):**
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

**Success Response (200):**
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

**Success Response (200):**
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

**Success Response (200):**
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

#### Get User Total Earnings
```http
GET /v1/users/analytics/earnings
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "message": "Total earnings fetched successfully",
  "totalEarnings": 1.50,
  "totalEarningsInCents": 150
}
```

### Post Routes

#### Get Posts (Randomized Feed)
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

**Success Response (200):**
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
      "moderationStatus": "approved"
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

**Request Body:**
```json
{
  "content": "Hello world! #trending @mention",
  "imageUrls": ["https://example.com/image.jpg"],
  "liveVideoUrl": "https://example.com/live-stream.m3u8",
  "postType": "live_video",
  "privacy": "public"
}
```

**Success Response (201):**
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

#### Share Post
```http
POST /v1/posts/share/:id
```

**Success Response (200):**
```json
{
  "message": "Post shared successfully"
}
```

#### Like Post
```http
POST /v1/posts/:postId/like
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "message": "Post liked successfully"
}
```

#### Get Post Likes
```http
GET /v1/posts/:postId/likes
```

**Success Response (200):**
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

#### Track Post View
```http
POST /v1/posts/:id/view
```

**Success Response (200):**
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

**Success Response (200):**
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

**Success Response (200):**
```json
{
  "message": "Post deleted successfully"
}
```

### Comment Routes

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

**Success Response (200):**
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

#### Create Comment
```http
POST /v1/comments/post/:postId
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "content": "Great post! #awesome @user"
}
```

**Success Response (201):**
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
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false
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

**Success Response (200):**
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

**Success Response (200):**
```json
{
  "message": "Comment deleted successfully"
}
```

### Like Routes

#### Like/Unlike Comment
```http
POST /v1/comments/:commentId/like
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
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

**Success Response (200):**
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

**Success Response (200):**
```json
{
  "message": "Reply liked",
  "liked": true
}
```

### Reply Routes

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

**Success Response (201):**
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
- `limit` (optional): Number of replies to return (max 100, default 20)
- `cursor` (optional): Cursor for pagination
- `sortBy` (optional): Sort order ("asc" or "desc", default "desc")

**Success Response (200):**
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

**Success Response (200):**
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

**Success Response (200):**
```json
{
  "message": "Reply deleted successfully"
}
```

### Image Routes

#### Upload Images
```http
POST /v1/images/upload
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Form Data:**
- `images`: File[] (up to 10 image files, max 10MB each)

**Success Response (200):**
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

### Session Routes

#### Get User Sessions
```http
GET /v1/sessions
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
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

**Success Response (200):**
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

**Success Response (200):**
```json
{
  "message": "All other sessions revoked successfully",
  "revokedCount": 3
}
```

### Content Moderation Routes

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

**Success Response (200):**
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

**Success Response (200):**
```json
{
  "safe": true,
  "reason": null,
  "confidence": 0.92
}
```

### Report Routes

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

**Success Response (201):**
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

**Success Response (200):**
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

### Block Routes

#### Block User
```http
POST /v1/blocks/user/:userId
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
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

**Success Response (200):**
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

**Success Response (200):**
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

#### Restrict User (Limit interactions without full block)
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

**Success Response (200):**
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

**Success Response (200):**
```json
{
  "message": "User restriction removed successfully"
}
```

### Recommendation Routes

#### Get User Recommendations
```http
GET /v1/recommendations?type=users&limit=10
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `type`: "users" or "posts" (default: "users")
- `limit`: Number of recommendations (default: 10)

**Success Response (200):**
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
GET /v1/recommendations/trending?limit=10
```

**Success Response (200):**
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

### Business Routes

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

**Success Response (201):**
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

#### Get Ad Campaigns
```http
GET /v1/business/campaigns?page=1&limit=10&status=active
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
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

**Success Response (200):**
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

**Success Response (200):**
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

**Success Response (200):**
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

### Analytics Routes

#### Get User Analytics
```http
GET /v1/analytics/user?period=30d
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `period`: "7d", "30d", or "90d" (default: "30d")

**Success Response (200):**
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

**Success Response (200):**
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

**Success Response (200):**
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

### Payment Routes

#### Get Available Payment Providers
```http
GET /v1/payments/providers
```

**Success Response (200):**
```json
{
  "provider": "PayMongo",
  "availableIn": "Philippines",
  "paymentMethods": [
    {
      "type": "credit_card",
      "name": "Credit Card",
      "supportedCards": ["Visa", "Mastercard", "JCB"],
      "fees": "3.9% + ₱15",
      "processingTime": "Instant"
    },
    {
      "type": "debit_card",
      "name": "Debit Card",
      "supportedCards": ["Visa", "Mastercard"],
      "fees": "3.9% + ₱15",
      "processingTime": "Instant"
    },
    {
      "type": "gcash",
      "name": "GCash",
      "fees": "₱15 flat fee",
      "processingTime": "Instant"
    },
    {
      "type": "grabpay",
      "name": "GrabPay",
      "fees": "₱15 flat fee",
      "processingTime": "Instant"
    },
    {
      "type": "maya",
      "name": "Maya (PayMaya)",
      "fees": "₱15 flat fee",
      "processingTime": "Instant"
    },
    {
      "type": "bank_transfer",
      "name": "Online Banking",
      "supportedBanks": ["BPI", "BDO", "Metrobank", "Unionbank", "RCBC", "Security Bank"],
      "fees": "₱15 flat fee",
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
      "features": ["Ad-free experience", "Priority support", "Extended analytics", "Custom themes"]
    },
    {
      "type": "pro",
      "name": "Pro",
      "price": 1120,
      "currency": "PHP",
      "interval": "month",
      "features": ["All Premium features", "Advanced analytics", "API access", "Custom branding", "Priority moderation"]
    }
  ]
}
```

#### Add Payment Method
```http
POST /v1/payments/methods
Authorization: Bearer <jwt_token>
```

**Request Body (Credit/Debit Card):**
```json
{
  "type": "paypal_card",
  "paymentMethodId": "pm_123456789",
  "last4": "1111",
  "expiryMonth": 12,
  "expiryYear": 2025,
  "holderName": "John Doe",
  "isDefault": true
}
```

**Request Body (PayPal):**
```json
{
  "type": "paypal_wallet",
  "paypalEmail": "john.doe@mail.com",
  "isDefault": false
}
```

**Success Response (201):**
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

**Error Response (400):**
```json
{
  "message": "Invalid payload",
  "errors": [
    {
      "code": "invalid_type",
      "expected": "number",
      "received": "string",
      "path": ["expiryMonth"],
      "message": "Expected number, received string"
    }
  ]
}
```

#### Get Payment Methods
```http
GET /v1/payments/methods
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "paymentMethods": [
    {
      "id": "pm_123456789",
      "type": "credit_card",
      "provider": "paymongo",
      "last4": "1111",
      "expiryMonth": 12,
      "expiryYear": 2025,
      "holderName": "John Doe",
      "isDefault": true,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "pm_987654321",
      "type": "gcash",
      "provider": "paymongo",
      "phoneNumber": "+639171234567",
      "isDefault": false,
      "createdAt": "2024-01-10T08:15:00Z"
    }
  ]
}
```

#### Delete Payment Method
```http
DELETE /v1/payments/methods/:paymentMethodId
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "message": "Payment method deleted successfully"
}
```

**Error Response (404):**
```json
{
  "message": "Payment method not found"
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

**Success Response (200):**
```json
{
  "message": "Payment initiated - complete payment to activate subscription",
  "paymentIntentId": "pi_123456789",
  "clientKey": "pi_123456789_client_key",
  "nextActionUrl": "https://api.paymongo.com/redirect/pi_123456789",
  "amount": 56000,
  "currency": "PHP",
  "description": "Premium Subscription"
}
```

**Error Responses:**
```json
{
  "message": "Invalid subscription type"
}
```
```json
{
  "message": "Payment method not found"
}
```
```json
{
  "message": "Payment failed",
  "error": "Your card was declined."
}
```

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
  subscription: "free" | "premium" | "pro";
  nextBillingDate?: Date;
  hasBlueCheck: boolean;
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
  postType: "text" | "live_video";
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
  ipAddress?: string;
  location?: string;
  isActive: boolean;
  expiresAt: Date;
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
  createdAt: Date;
}
```

### PaymentMethod
```typescript
{
  id: string;
  userId: string;
  type: "paypal_card" | "paypal_wallet";
  provider: string;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  holderName?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Mention
```typescript
{
  id: string;
  postId?: string;
  commentId?: string;
  username: string;
  createdAt: Date;
}
```

### Hashtag
```typescript
{
  id: string;
  postId?: string;
  commentId?: string;
  tag: string;
  createdAt: Date;
}
```

### CommentLike
```typescript
{
  id: string;
  commentId: string;
  userId: string;
  createdAt: Date;
}
```

### PostAnalytics
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

### Example Error Response
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid input data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## Content Moderation

The API includes AI-powered content moderation that:
- Automatically screens posts, comments, and replies for inappropriate content
- Checks images for sensitive material using AI analysis
- Supports manual reporting and review workflows
- Blocks content that violates community guidelines

## Session Management

Enhanced session management includes:
- Device tracking for each login session
- Location-based session monitoring
- Active session validation
- Ability to revoke individual or all sessions
- Session expiration handling

## Hashtags and Mentions

Posts, comments, and replies support:
- **Hashtags**: Automatically extracted from content starting with `#`
- **Mentions**: Automatically extracted from content starting with `@`
- Searchable and linkable content discovery

## Live Streaming

Posts support live video streaming:
- `postType: "live_video"` for streaming posts
- `liveVideoUrl` field for stream URLs (HLS/RTMP supported)
- Real-time engagement tracking during streams

## Creator Monetization

Built-in creator earnings system:
- Automatic earnings calculation based on engagement
- View, share, and click tracking
- Earnings stored in cents for precision
- Analytics dashboard

## ActivityPub Routes

### WebFinger Discovery
```
GET /.well-known/webfinger?resource=acct:username@domain
```
Discover ActivityPub actors for federation with Mastodon and other ActivityPub services.

**Query Parameters:**
- `resource` (required): Resource identifier in format `acct:username@domain`

**Response:**
```json
{
  "subject": "acct:john@example.com",
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://example.com/activitypub/users/john"
    }
  ]
}
```

### User Actor Profile
```
GET /activitypub/users/:username
```
Returns the ActivityPub actor profile for federation.

**Headers Required:**
- `Accept: application/activity+json`

**Response:**
```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1"
  ],
  "id": "https://example.com/activitypub/users/john",
  "type": "Person",
  "preferredUsername": "john",
  "name": "John Doe",
  "summary": "User bio here",
  "icon": {
    "type": "Image",
    "mediaType": "image/jpeg",
    "url": "https://example.com/avatar.jpg"
  },
  "inbox": "https://example.com/activitypub/users/john/inbox",
  "outbox": "https://example.com/activitypub/users/john/outbox",
  "followers": "https://example.com/activitypub/users/john/followers",
  "following": "https://example.com/activitypub/users/john/following",
  "publicKey": {
    "id": "https://example.com/activitypub/users/john#main-key",
    "owner": "https://example.com/activitypub/users/john",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n..."
  }
}
```

### User Outbox
```
GET /activitypub/users/:username/outbox
GET /activitypub/users/:username/outbox?page=1
```
Returns user's public posts in ActivityPub format.

**Headers Required:**
- `Accept: application/activity+json`

**Response (Collection Summary):**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/activitypub/users/john/outbox",
  "type": "OrderedCollection",
  "totalItems": 42,
  "first": "https://example.com/activitypub/users/john/outbox?page=1"
}
```

**Response (Paginated Posts):**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/activitypub/users/john/outbox?page=1",
  "type": "OrderedCollectionPage",
  "partOf": "https://example.com/activitypub/users/john/outbox",
  "orderedItems": [
    {
      "id": "https://example.com/posts/123/activity",
      "type": "Create",
      "actor": "https://example.com/activitypub/users/john",
      "published": "2024-01-15T10:30:00Z",
      "object": {
        "id": "https://example.com/posts/123",
        "type": "Note",
        "content": "Hello, fediverse!",
        "attributedTo": "https://example.com/activitypub/users/john",
        "to": ["https://www.w3.org/ns/activitystreams#Public"],
        "published": "2024-01-15T10:30:00Z"
      }
    }
  ]
}
```

### User Inbox
```
POST /activitypub/inbox
```
Receives ActivityPub activities from other federated instances.

**Headers Required:**
- `Content-Type: application/activity+json`
- `Signature: keyId="...",algorithm="rsa-sha256",headers="...",signature="..."`

**Supported Activity Types:**

**Follow Activity:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://mastodon.social/activities/123",
  "type": "Follow",
  "actor": "https://mastodon.social/users/alice",
  "object": "https://example.com/activitypub/users/john"
}
```

**Undo Follow Activity:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://mastodon.social/activities/124",
  "type": "Undo",
  "actor": "https://mastodon.social/users/alice",
  "object": {
    "id": "https://mastodon.social/activities/123",
    "type": "Follow",
    "actor": "https://mastodon.social/users/alice",
    "object": "https://example.com/activitypub/users/john"
  }
}
```

**Like Activity:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://mastodon.social/activities/125",
  "type": "Like",
  "actor": "https://mastodon.social/users/alice",
  "object": "https://example.com/posts/123"
}
```

**Create Note Activity:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://mastodon.social/activities/126",
  "type": "Create",
  "actor": "https://mastodon.social/users/alice",
  "object": {
    "id": "https://mastodon.social/posts/456",
    "type": "Note",
    "content": "@john Hello from Mastodon!",
    "attributedTo": "https://example.com/activitypub/users/alice",
    "to": ["https://www.w3.org/ns/activitystreams#Public"],
    "published": "2024-01-15T11:00:00Z"
  }
}
```

**Response:**
```json
{
  "message": "Activity accepted"
}
```

### ActivityPub Federation Features

- **User Discovery**: WebFinger protocol for finding users across instances
- **Follow/Unfollow**: Users from other ActivityPub instances can follow your users
- **Content Sharing**: Public posts are federated to follower instances
- **Interactions**: Receive likes, replies, and mentions from federated users
- **HTTP Signatures**: Cryptographic verification of federated requests
- **Content Types**: Support for Note objects (posts) with text and images

### Federation Security

- RSA key pairs generated for each user for message signing
- HTTP signature verification for incoming activities
- Actor verification through public key cryptography
- Secure inbox delivery with proper authentication for creators

## Rate Limiting
The API implements rate limiting to prevent abuse. Current limits:
- Authentication endpoints: 5 requests per minute
- General endpoints: 100 requests per minute
- File upload endpoints: 10 requests per minute
- Content moderation: 50 requests per minute

## Subscription Tiers
- **Free**: Basic features, limited posts per day
- **Premium**: Enhanced features, blue check eligibility, advanced analytics
- **Pro**: Full access, priority support, enhanced monetization