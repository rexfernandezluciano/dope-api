
# DOPE Network API

A comprehensive social media API for the DOPE Network platform, built with Node.js, Express, TypeScript, and Prisma.

## Features

- **User Management**: Registration, authentication, profile management
- **Posts**: Create text and live video posts with optional images
- **Comments**: Comment on posts with full CRUD operations
- **Likes**: Like/unlike posts
- **Follow System**: Follow/unfollow users
- **Email Verification**: Secure email verification system
- **Subscription Tiers**: Free, Premium, and Pro subscriptions
- **Blue Check Verification**: Verified badges for premium users

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens
- **Validation**: Zod schemas
- **Email**: Custom mailer utility

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables in `.env`:
```env
DATABASE_URL="your_postgresql_connection_string"
JWT_SECRET="your_jwt_secret"
JWT_EXPIRES_IN="604800"
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
```

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "password": "password123",
  "photoURL": "https://example.com/photo.jpg",
  "subscription": "free", // optional: "free" | "premium" | "pro"
  "privacy": { // optional
    "profile": "public",
    "comments": "public",
    "sharing": true,
    "chat": "public"
  }
}
```

#### Verify Email
```http
POST /api/auth/verify-email
```

**Body:**
```json
{
  "email": "john@example.com",
  "code": "123456",
  "verificationId": "verification_id_here"
}
```

#### Resend Verification Code
```http
POST /api/auth/resend-code
```

**Body:**
```json
{
  "email": "john@example.com"
}
```

#### Login
```http
POST /api/auth/login
```

**Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "uid": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "photoURL": "https://example.com/photo.jpg",
    "hasBlueCheck": false,
    "subscription": "free",
    "privacy": {},
    "hasVerifiedEmail": true
  }
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

### Posts

#### Get All Posts
```http
GET /api/posts
```

**Query Parameters:**
- `limit` (optional): Number of posts to return (max 100, default 20)
- `cursor` (optional): Cursor for pagination (post ID)
- `author` (optional): Filter by author username
- `postType` (optional): Filter by post type ("text" | "live_video")
- `hasImages` (optional): Filter posts with images ("true" | "false")
- `hasLiveVideo` (optional): Filter posts with live video ("true" | "false")
- `search` (optional): Search in post content

**Example:**
```http
GET /api/posts?limit=10&author=johndoe&postType=text&hasImages=true&search=hello
```

**Response:**
```json
{
  "posts": [
    {
      "id": "post_id",
      "content": "Hello world!",
      "imageUrls": ["https://example.com/image.jpg"],
      "liveVideoUrl": null,
      "postType": "text",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "uid": "user_id",
        "name": "John Doe",
        "username": "johndoe",
        "photoURL": "https://example.com/photo.jpg",
        "hasBlueCheck": false
      },
      "comments": [], // First 3 comments only
      "likes": [],
      "_count": {
        "comments": 5,
        "likes": 10
      }
    }
  ],
  "nextCursor": "next_post_id",
  "hasMore": true,
  "limit": 10
}
```

#### Get Single Post
```http
GET /api/posts/:id
```

#### Create Post
```http
POST /api/posts
Authorization: Bearer <jwt_token>
```

**Body:**
```json
{
  "content": "Hello world!", // optional for live_video posts
  "imageUrls": ["https://example.com/image.jpg"], // optional
  "liveVideoUrl": "https://example.com/live-stream.m3u8", // required for live_video posts
  "postType": "text" // "text" | "live_video", defaults to "text"
}
```

**Post Types:**
- `text`: Regular text posts (require either content or images)
- `live_video`: Live video posts (require liveVideoUrl)

#### Update Post
```http
PUT /api/posts/:id
Authorization: Bearer <jwt_token>
```

**Body:**
```json
{
  "content": "Updated content",
  "imageUrls": ["https://example.com/new-image.jpg"],
  "liveVideoUrl": "https://example.com/live-stream.m3u8",
  "postType": "live_video"
}
```

#### Delete Post
```http
DELETE /api/posts/:id
Authorization: Bearer <jwt_token>
```

#### Like/Unlike Post
```http
POST /api/posts/:id/like
Authorization: Bearer <jwt_token>
```

### Comments

#### Get Comments for Post
```http
GET /api/comments/post/:postId
```

**Query Parameters:**
- `limit` (optional): Number of comments to return (max 100, default 20)
- `cursor` (optional): Cursor for pagination (comment ID)
- `author` (optional): Filter by author username
- `search` (optional): Search in comment content
- `sortBy` (optional): Sort order ("asc" | "desc", default "desc")

**Example:**
```http
GET /api/comments/post/post123?limit=10&author=johndoe&search=great&sortBy=asc
```

**Response:**
```json
{
  "comments": [
    {
      "id": "comment_id",
      "content": "Great post!",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "uid": "user_id",
        "name": "John Doe",
        "username": "johndoe",
        "photoURL": "https://example.com/photo.jpg",
        "hasBlueCheck": false
      }
    }
  ],
  "nextCursor": "next_comment_id",
  "hasMore": true,
  "limit": 10,
  "sortBy": "asc"
}
```

#### Create Comment
```http
POST /api/comments/post/:postId
Authorization: Bearer <jwt_token>
```

**Body:**
```json
{
  "content": "Great post!"
}
```

#### Update Comment
```http
PUT /api/comments/:id
Authorization: Bearer <jwt_token>
```

**Body:**
```json
{
  "content": "Updated comment"
}
```

#### Delete Comment
```http
DELETE /api/comments/:id
Authorization: Bearer <jwt_token>
```

### Users

#### Get All Users
```http
GET /api/users
```

#### Get User by Username
```http
GET /api/users/:username
```

#### Get User Followers
```http
GET /api/users/:username/followers
```

#### Get User Following
```http
GET /api/users/:username/following
```

#### Update User Profile
```http
PUT /api/users/:username
Authorization: Bearer <jwt_token>
```

**Body:**
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

#### Follow/Unfollow User
```http
POST /api/users/:username/follow
Authorization: Bearer <jwt_token>
```

## Data Models

### User
- `uid`: Unique identifier
- `username`: Unique username
- `email`: Unique email address
- `name`: Display name
- `bio`: User biography
- `photoURL`: Profile picture URL
- `subscription`: "free" | "premium" | "pro"
- `hasBlueCheck`: Verification status
- `privacy`: Privacy settings object
- `hasVerifiedEmail`: Email verification status

### Post
- `id`: Unique identifier
- `content`: Post content (optional)
- `imageUrls`: Array of image URLs (optional)
- `liveVideoUrl`: Live video stream URL (required for live_video posts)
- `postType`: "text" | "live_video"
- `authorId`: Reference to user
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

### Comment
- `id`: Unique identifier
- `content`: Comment content
- `postId`: Reference to post
- `authorId`: Reference to user
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Tokens expire after 7 days by default.

## Subscription Tiers

- **Free**: Basic access
- **Premium**: Blue check verification + enhanced features
- **Pro**: Blue check verification + premium features + advanced tools

Premium and Pro users automatically receive blue check verification.

## Error Responses

The API returns standard HTTP status codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

Error response format:
```json
{
  "message": "Error description",
  "errors": [] // Validation errors (if applicable)
}
```

## Development

### Scripts

- `npm run dev`: Start development server with hot reload
- `npm run build`: Build for production
- `npm start`: Start production server
- `npm run migrate`: Run database migrations

### Project Structure

```
src/
├── controllers/     # Route handlers
├── middleware/      # Express middleware
├── routes/         # Route definitions
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── index.ts        # Application entry point
```

## License

Apache-2.0

## Author

Rex Luciano

## Repository

[GitHub Repository](https://github.com/rexfernandezluciano/dope-api)
