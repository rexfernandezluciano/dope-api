# DOPE Network API Documentation

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Authentication](#authentication)
  - [Register User](#register-user)
  - [Google Login/Signup](#google-loginsignup)
  - [Email Login](#email-login)
  - [Verify Email](#verify-email)
  - [Get Current User](#get-current-user)
- [Posts](#posts)
  - [Create Post](#create-post)
  - [Get Posts](#get-posts)
  - [Get Following Feed](#get-following-feed)
- [Comments](#comments)
  - [Create Comment](#create-comment)
  - [Get Comments](#get-comments)
- [Users](#users)
  - [Get User Profile](#get-user-profile)
  - [Follow User](#follow-user)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Authentication](#authentication-1)

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

## Authentication

### Register User
```http
POST /api/auth/register
```

Request Body:

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

Success Response:

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

Google Login/Signup

```http
POST /api/auth/google
```

Request Body:

```json
{
  "idToken": "google_id_token"
}
```

Success Response:

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
  "accessToken": "jwt_token",
  "refreshToken": "jwt_refresh_token"
}
```

Email Login

```http
POST /api/auth/login
```

Request Body:

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

Success Response:

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
  "accessToken": "jwt_token",
  "refreshToken": "jwt_refresh_token"
}
```

Verify Email

```http
POST /api/auth/verify-email
```

Request Body:

```json
{
  "email": "john@example.com",
  "code": "123456",
  "verificationId": "verification_id_here"
}
```

Get Current User

```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

Posts

Create Post

```http
POST /api/posts
Authorization: Bearer <jwt_token>
```

Request Body:

```json
{
  "content": "Hello world!",
  "imageUrls": ["https://example.com/image.jpg"],
  "liveVideoUrl": "https://example.com/live-stream.m3u8",
  "postType": "text"
}
```

Success Response:

```json
{
  "id": "post_id",
  "content": "Hello world!",
  "imageUrls": ["https://example.com/image.jpg"],
  "postType": "text",
  "author": {
    "uid": "user_id",
    "name": "John Doe",
    "username": "johndoe"
  }
}
```

Get Posts

```http
GET /api/posts
```

Query Parameters:

· limit: Number of posts (default: 20)
· cursor: Pagination cursor
· author: Filter by username
· postType: "text" or "live_video"
· search: Search term

Get Following Feed

```http
GET /api/posts/feed/following
Authorization: Bearer <jwt_token>
```

Comments

Create Comment

```http
POST /api/comments/post/:postId
Authorization: Bearer <jwt_token>
```

Request Body:

```json
{
  "content": "Great post!"
}
```

Get Comments

```http
GET /api/comments/post/:postId
```

Query Parameters:

· limit: Number of comments (default: 20)
· sortBy: "asc" or "desc"

Users

Get User Profile

```http
GET /api/users/:username
```

Follow User

```http
POST /api/users/:username/follow
Authorization: Bearer <jwt_token>
```

Data Models

User

```typescript
interface User {
  uid: string;
  username: string;
  email: string;
  name: string;
  photoURL?: string;
  subscription: "free" | "premium" | "pro";
  hasBlueCheck: boolean;
  hasVerifiedEmail: boolean;
}
```

Post

```typescript
interface Post {
  id: string;
  content?: string;
  imageUrls: string[];
  liveVideoUrl?: string;
  postType: "text" | "live_video";
  authorId: string;
}
```

Error Handling

Standard HTTP status codes with JSON response:

```json
{
  "message": "Error description",
  "errors": ["validation_error_details"]
}
```

Authentication

Include JWT in Authorization header:

```
Authorization: Bearer <your_jwt_token>
```