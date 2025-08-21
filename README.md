
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
  - [Session Routes](#session-routes)
- [Data Models](#data-models)
- [Error Handling](#error-handling)

## Overview
A comprehensive social media API for the DOPE Network platform supporting user profiles, posts, comments, and social interactions.

## Features
- User registration and authentication
- Text and live video posts
- Comments and likes system
- User following system
- Email verification
- Subscription tiers (Free, Premium, Pro)
- Verified badges (Blue Check)
- Session management
- Google OAuth integration

## Base URL
```
https://social.dopp.eu.org/v1
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

#### Email Login
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

**Success Response (200):**
```json
{
  "token": "jwt_token",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false,
    "membership": {
      "subscription": "premium",
      "nextBillingDate": "2025-12-12T06:09:00.000Z"
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

#### Google Login/Signup
```http
POST /v1/auth/google
```

**Request Body:**
```json
{
  "token": "google_id_token"
}
```

**Success Response (200/201):**
```json
{
  "token": "jwt_token",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe_abc123",
    "email": "john@gmail.com",
    "photoURL": "https://lh3.googleusercontent.com/...",
    "hasBlueCheck": false,
    "membership": {
      "subscription": "free",
      "nextBillingDate": null
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

#### Google OAuth Initiation
```http
GET /v1/auth/google
```

Redirects to Google OAuth consent screen.

#### Google OAuth Callback
```http
GET /v1/auth/google/callback
```

Handles the OAuth callback from Google.

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

#### Validate Verification ID
```http
GET /v1/auth/validate-verification-id/:verificationId
```

**Success Response (200):**
```json
{
  "message": "Verification ID is valid",
  "email": "john@example.com"
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
    "createdAt": "2024-01-15T10:30:00Z",
    "posts": [
      {
        "id": "post_id",
        "content": "Hello world!",
        "imageUrls": ["https://example.com/image.jpg"],
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z",
        "stats": {
          "comments": 5,
          "likes": 25
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
        "author": {
          "uid": "user_id",
          "name": "John Doe",
          "username": "johndoe",
          "photoURL": "https://example.com/photo.jpg",
          "hasBlueCheck": false
        }
      }
    ],
    "likes": {
      "user": {
        "uid": "user_id",
        "username": "johndoe"
      }
    },
    "stats": {
      "posts": 42,
      "followers": 150,
      "following": 75
    },
    "isFollowedByCurrentUser": false
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

#### Get Posts
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
      "content": "Hello world!",
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
      "privacy": "public"
    }
  ],
  "nextCursor": "cursor_string",
  "hasMore": true,
  "limit": 20
}
```

#### Get Single Post
```http
GET /v1/posts/:id
```

**Success Response (200):**
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
    "privacy": "public"
  }
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
  "content": "Hello world!",
  "imageUrls": ["https://example.com/image.jpg"],
  "liveVideoUrl": "https://example.com/live-stream.m3u8",
  "postType": "text",
  "privacy": "public"
}
```

**Success Response (201):**
```json
{
  "id": "post_id",
  "content": "Hello world!",
  "imageUrls": ["https://example.com/image.jpg"],
  "liveVideoUrl": null,
  "postType": "text",
  "privacy": "public",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "authorId": "user_id",
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

#### Update Post
```http
PUT /v1/posts/:id
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "content": "Updated content",
  "imageUrls": ["https://example.com/new-image.jpg"],
  "liveVideoUrl": "https://example.com/new-stream.m3u8",
  "postType": "text",
  "privacy": "public"
}
```

**Success Response (200):**
```json
{
  "id": "post_id",
  "content": "Updated content",
  "imageUrls": ["https://example.com/new-image.jpg"],
  "liveVideoUrl": null,
  "postType": "text",
  "privacy": "public",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T11:00:00Z",
  "authorId": "user_id",
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false
  },
  "_count": {
    "comments": 5,
    "likes": 25
  }
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

#### Like/Unlike Post
```http
POST /v1/posts/:id/like
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "message": "Post liked",
  "liked": true
}
```

#### Get Following Feed
```http
GET /v1/posts/feed/following
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit`: Number of posts (default: 20, max: 100)
- `cursor`: Pagination cursor

**Success Response (200):**
```json
{
  "status": "ok",
  "posts": [
    {
      "id": "post_id",
      "content": "Hello from following!",
      "imageUrls": [],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "stats": {
        "comments": 2,
        "likes": 10,
        "views": 50,
        "shares": 1
      },
      "author": {
        "uid": "user_id",
        "name": "Friend",
        "username": "friend_username",
        "photoURL": "https://example.com/friend.jpg",
        "hasBlueCheck": false,
        "isFollowedByCurrentUser": true
      },
      "comments": [],
      "likes": [],
      "postType": "text",
      "liveVideoUrl": null,
      "privacy": "public"
    }
  ],
  "nextCursor": "cursor_string",
  "hasMore": true,
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

#### Track Post Earnings
```http
POST /v1/posts/:id/earnings
```

**Success Response (200):**
```json
{
  "message": "Earnings calculated and tracked",
  "earnings": 0.001,
  "earningsInCents": 1
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

#### Get Current User Posts
```http
GET /v1/posts/user/me
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "status": "ok",
  "posts": [
    {
      "id": "post_id",
      "content": "My post",
      "imageUrls": [],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "stats": {
        "comments": 2,
        "likes": 10,
        "earnings": 1,
        "views": 50,
        "shares": 1,
        "clicks": 5
      },
      "author": {
        "uid": "user_id",
        "name": "John Doe",
        "username": "johndoe",
        "photoURL": "https://example.com/photo.jpg",
        "hasBlueCheck": false,
        "isFollowedByCurrentUser": false
      },
      "likes": [],
      "comments": [],
      "postType": "text",
      "liveVideoUrl": null,
      "privacy": "public"
    }
  ]
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

**Error Response (500):**
```json
{
  "error": "Failed to upload images"
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

**Success Response (200):**
```json
{
  "comments": [
    {
      "id": "comment_id",
      "content": "Great post!",
      "createdAt": "2024-01-15T10:35:00Z",
      "updatedAt": "2024-01-15T10:35:00Z",
      "postId": "post_id",
      "authorId": "user_id",
      "author": {
        "uid": "user_id",
        "name": "Commenter",
        "username": "commenter_username",
        "photoURL": "https://example.com/commenter.jpg",
        "hasBlueCheck": false
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

**Request Body:**
```json
{
  "content": "Great post!"
}
```

**Success Response (201):**
```json
{
  "id": "comment_id",
  "content": "Great post!",
  "createdAt": "2024-01-15T10:35:00Z",
  "updatedAt": "2024-01-15T10:35:00Z",
  "postId": "post_id",
  "authorId": "user_id",
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

#### Search Comments
```http
GET /v1/comments/search
```

**Query Parameters:**
- `query`: Search query (required)
- `limit`: Number of results (default: 20, max: 100)
- `cursor`: Pagination cursor
- `author`: Filter by username
- `postId`: Filter by post ID
- `sortBy`: "desc" or "asc" (default: "desc")

**Success Response (200):**
```json
{
  "comments": [
    {
      "id": "comment_id",
      "content": "Matching comment content",
      "createdAt": "2024-01-15T10:35:00Z",
      "updatedAt": "2024-01-15T10:35:00Z",
      "postId": "post_id",
      "authorId": "user_id",
      "author": {
        "uid": "user_id",
        "name": "Author Name",
        "username": "author_username",
        "photoURL": "https://example.com/author.jpg",
        "hasBlueCheck": false
      },
      "post": {
        "id": "post_id",
        "content": "Original post content",
        "postType": "text",
        "author": {
          "uid": "post_author_id",
          "name": "Post Author",
          "username": "post_author_username",
          "photoURL": "https://example.com/post_author.jpg",
          "hasBlueCheck": false
        }
      }
    }
  ],
  "nextCursor": "cursor_string",
  "hasMore": true,
  "limit": 20,
  "sortBy": "desc",
  "query": "search_term"
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
      "ipAddress": "192.168.1.1",
      "location": "New York, US",
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
  createdAt: Date;
  updatedAt: Date;
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
- `401` - Unauthorized
- `403` - Forbidden
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

## Rate Limiting
The API implements rate limiting to prevent abuse. Current limits:
- Authentication endpoints: 5 requests per minute
- General endpoints: 100 requests per minute
- File upload endpoints: 10 requests per minute

## Subscription Tiers
- **Free**: Basic features, limited posts per day
- **Premium**: Enhanced features, blue check eligibility
- **Pro**: Full access, advanced analytics, priority support
