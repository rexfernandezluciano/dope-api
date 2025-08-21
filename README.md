
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
  "message": "User registered successfully",
  "verificationId": "verification_uuid",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "hasVerifiedEmail": false,
    "subscription": "free"
  }
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
  "message": "Email verified successfully",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "hasVerifiedEmail": true,
    "subscription": "free"
  },
  "token": "jwt_token",
  "refreshToken": "jwt_refresh_token" // Comming soon
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
  "message": "Verification code sent",
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
  "message": "Login successful",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "hasVerifiedEmail": true,
    "subscription": "premium"
  },
  "token": "jwt_token",
  "refreshToken": "jwt_refresh_token" // Coming soon
}
```

#### Google Login/Signup
```http
POST /v1/auth/google
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
  "message": "Google authentication successful",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe_abc123",
    "email": "john@gmail.com",
    "photoURL": "https://lh3.googleusercontent.com/...",
    "hasBlueCheck": false,
    "subscription": "free"
  },
  "token": "jwt_token",
  "refreshToken": "jwt_refresh_token" // Coming soon
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
  "valid": true,
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
  "uid": "user_id",
  "name": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "photoURL": "https://example.com/photo.jpg",
  "hasVerifiedEmail": true,
  "hasBlueCheck": false,
  "membership": {
    "subscription": "premium",
    "nextBillingDate": "2025-12-12-6:09:AM"
  },
  "stats": {
    "posts": 9,
    "following": 1,
    "followers": 23,
    "earnings": 127
  },
  "privacy": {
    "profile": "public",
    "comments": "public",
    "sharing": true,
    "chat": "public"
  }
}
```

### User Routes

#### Get All Users
```http
GET /v1/users
```

**Query Parameters:**
- `limit`: Number of users (default: 20)
- `cursor`: Pagination cursor
- `search`: Search term

**Success Response (200):**
```json
{
  "users": [
    {
      "uid": "user_id",
      "name": "John Doe",
      "username": "johndoe",
      "photoURL": "https://example.com/photo.jpg",
      "hasBlueCheck": false,
      "subscription": "free"
    }
  ],
  "nextCursor": "cursor_string"
}
```

#### Get User by Username
```http
GET /v1/users/:username
```

**Success Response (200):**
```json
{
  "uid": "user_id",
  "name": "John Doe",
  "username": "johndoe",
  "photoURL": "https://example.com/photo.jpg",
  "hasBlueCheck": false,
  "membership": {
    "subscription": "premium"
  },
  "stats": {
    "followers": 150,
    "following": 75,
    "posts": 42,
  }
  "isFollowedByCurrentUser": false
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
  "message": "User updated successfully",
  "user": {
    "uid": "user_id",
    "name": "Updated Name",
    "username": "johndoe",
    "photoURL": "https://example.com/new-photo.jpg"
  }
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
  "message": "User followed successfully",
  "isFollowing": true
}
```

#### Get User Followers
```http
GET /v1/users/:username/followers
```

**Success Response (200):**
```json
{
  "followers": [
    {
      "uid": "follower_id",
      "name": "Follower Name",
      "username": "follower_username",
      "photoURL": "https://example.com/follower.jpg"
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
  "following": [
    {
      "uid": "following_id",
      "name": "Following Name",
      "username": "following_username",
      "photoURL": "https://example.com/following.jpg"
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
  "totalEarnings": 150.75,
  "currency": "USD",
  "period": "all_time"
}
```

### Post Routes

#### Get Posts
```http
GET /v1/posts
```

**Query Parameters:**
- `limit`: Number of posts (default: 20)
- `cursor`: Pagination cursor
- `author`: Filter by username
- `postType`: "text" or "live_video"
- `search`: Search term

**Success Response (200):**
```json
{
  "posts": [
    {
      "id": "post_id",
      "content": "Hello world!",
      "imageUrls": ["https://example.com/image.jpg"],
      "postType": "text",
      "likesCount": 25,
      "commentsCount": 5,
      "viewsCount": 100,
      "createdAt": "2024-01-15T10:30:00Z",
      "author": {
        "uid": "user_id",
        "name": "John Doe",
        "username": "johndoe",
        "photoURL": "https://example.com/photo.jpg",
        "hasBlueCheck": false
      },
      "isLiked": false
    }
  ],
  "nextCursor": "cursor_string"
}
```

#### Get Single Post
```http
GET /v1/posts/:id
```

**Success Response (200):**
```json
{
  "id": "post_id",
  "content": "Hello world!",
  "imageUrls": ["https://example.com/image.jpg"],
  "liveVideoUrl": "https://example.com/live-stream.m3u8",
  "postType": "text",
  "likesCount": 25,
  "commentsCount": 5,
  "viewsCount": 100,
  "createdAt": "2024-01-15T10:30:00Z",
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false
  },
  "isLiked": false
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
  "postType": "text"
}
```

**Success Response (201):**
```json
{
  "id": "post_id",
  "content": "Hello world!",
  "imageUrls": ["https://example.com/image.jpg"],
  "postType": "text",
  "createdAt": "2024-01-15T10:30:00Z",
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe",
    "photoURL": "https://example.com/photo.jpg"
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
  "content": "Updated content"
}
```

**Success Response (200):**
```json
{
  "message": "Post updated successfully",
  "post": {
    "id": "post_id",
    "content": "Updated content",
    "updatedAt": "2024-01-15T11:00:00Z"
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
  "message": "Post liked successfully",
  "isLiked": true,
  "likesCount": 26
}
```

#### Get Following Feed
```http
GET /v1/posts/feed/following
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit`: Number of posts (default: 20)
- `cursor`: Pagination cursor

**Success Response (200):**
```json
{
  "posts": [
    {
      "id": "post_id",
      "content": "Hello from following!",
      "author": {
        "uid": "user_id",
        "name": "Friend",
        "username": "friend_username"
      }
    }
  ],
  "nextCursor": "cursor_string"
}
```

#### Track Post View
```http
POST /v1/posts/:id/view
```

**Success Response (200):**
```json
{
  "message": "View tracked successfully"
}
```

#### Track Post Earnings
```http
POST /v1/posts/:id/earnings
```

**Request Body:**
```json
{
  "amount": 5.50,
  "currency": "USD"
}
```

**Success Response (200):**
```json
{
  "message": "Earnings tracked successfully"
}
```

#### Update Post Engagement
```http
POST /v1/posts/:id/engagement
```

**Request Body:**
```json
{
  "engagementType": "share",
  "value": 1
}
```

**Success Response (200):**
```json
{
  "message": "Engagement updated successfully"
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
  "posts": [
    {
      "id": "post_id",
      "content": "My post",
      "likesCount": 10,
      "commentsCount": 2
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
  "message": "Post shared successfully",
  "shareUrl": "https://example.com/posts/post_id"
}
```

### Comment Routes

#### Get Comments for Post
```http
GET /v1/comments/post/:postId
```

**Query Parameters:**
- `limit`: Number of comments (default: 20)
- `cursor`: Pagination cursor

**Success Response (200):**
```json
{
  "comments": [
    {
      "id": "comment_id",
      "content": "Great post!",
      "createdAt": "2024-01-15T10:35:00Z",
      "author": {
        "uid": "user_id",
        "name": "Commenter",
        "username": "commenter_username",
        "photoURL": "https://example.com/commenter.jpg"
      }
    }
  ],
  "nextCursor": "cursor_string"
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
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe"
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
  "message": "Comment updated successfully",
  "comment": {
    "id": "comment_id",
    "content": "Updated comment",
    "updatedAt": "2024-01-15T11:00:00Z"
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
- `q`: Search query
- `limit`: Number of results (default: 20)

**Success Response (200):**
```json
{
  "comments": [
    {
      "id": "comment_id",
      "content": "Matching comment content",
      "author": {
        "username": "author_username"
      }
    }
  ]
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
      "deviceInfo": "Chrome on Windows",
      "ipAddress": "192.168.1.1",
      "location": "New York, US",
      "lastActivity": "2024-01-15T10:30:00Z",
      "isCurrent": true
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
  "message": "All sessions revoked successfully"
}
```

## Data Models

### User
```typescript
{
  uid: string;
  name: string;
  username: string;
  email: string;
  photoURL?: string;
  hasVerifiedEmail: boolean;
  hasBlueCheck: boolean;
  subscription: "free" | "premium" | "pro";
  privacy: {
    profile: "public" | "private";
    comments: "public" | "followers" | "private";
    sharing: boolean;
    chat: "public" | "followers" | "private";
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Post
```typescript
{
  id: string;
  content: string;
  imageUrls: string[];
  liveVideoUrl?: string;
  postType: "text" | "live_video";
  authorId: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
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
