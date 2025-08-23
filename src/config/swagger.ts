
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DOPE Network API',
      version: '1.0.0',
      description: 'A comprehensive social media platform API built with Node.js, Express, TypeScript, and Prisma. It supports user profiles, posts, comments, social interactions, content moderation, payments, live streaming, and ActivityPub federation.',
      contact: {
        name: 'Rex Luciano',
        url: 'https://github.com/rexfernandezluciano/dope-api',
        email: 'support@dopp.eu.org'
      },
      license: {
        name: 'Apache 2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
      }
    },
    servers: [
      {
        url: 'https://api.dopp.eu.org',
        description: 'Production server'
      },
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            uid: {
              type: 'string',
              description: 'Unique user identifier'
            },
            username: {
              type: 'string',
              description: 'User\'s unique username'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User\'s email address'
            },
            name: {
              type: 'string',
              description: 'User\'s display name'
            },
            bio: {
              type: 'string',
              description: 'User\'s biography'
            },
            photoURL: {
              type: 'string',
              format: 'uri',
              description: 'URL to user\'s profile photo'
            },
            hasBlueCheck: {
              type: 'boolean',
              description: 'Whether user has verification badge'
            },
            subscription: {
              type: 'string',
              enum: ['free', 'premium', 'pro'],
              description: 'User\'s subscription tier'
            },
            hasVerifiedEmail: {
              type: 'boolean',
              description: 'Whether user\'s email is verified'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            }
          }
        },
        Post: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique post identifier'
            },
            content: {
              type: 'string',
              description: 'Post content text'
            },
            imageUrls: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri'
              },
              description: 'Array of image URLs'
            },
            postType: {
              type: 'string',
              enum: ['text', 'live_video', 'poll'],
              description: 'Type of post'
            },
            privacy: {
              type: 'string',
              enum: ['public', 'private', 'followers'],
              description: 'Post privacy setting'
            },
            author: {
              $ref: '#/components/schemas/User'
            },
            poll: {
              $ref: '#/components/schemas/Poll'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Poll: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique poll identifier'
            },
            question: {
              type: 'string',
              description: 'Poll question'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Poll expiration timestamp'
            },
            allowMultiple: {
              type: 'boolean',
              description: 'Whether multiple choices are allowed'
            },
            hasUserVoted: {
              type: 'boolean',
              description: 'Whether current user has voted'
            },
            totalVotes: {
              type: 'integer',
              description: 'Total number of votes'
            },
            options: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/PollOption'
              }
            }
          }
        },
        PollOption: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique option identifier'
            },
            text: {
              type: 'string',
              description: 'Option text'
            },
            votes: {
              type: 'integer',
              description: 'Number of votes for this option'
            },
            percentage: {
              type: 'number',
              description: 'Percentage of total votes'
            },
            isUserChoice: {
              type: 'boolean',
              description: 'Whether current user selected this option'
            }
          }
        },
        Comment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique comment identifier'
            },
            content: {
              type: 'string',
              description: 'Comment content'
            },
            author: {
              $ref: '#/components/schemas/User'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Human readable error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Additional error details'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // Paths to files containing OpenAPI definitions
};

const specs = swaggerJSDoc(options);

export { specs, swaggerUi };
