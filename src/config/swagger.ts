import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Wardaya Subs API',
      version: '1.0.0',
      description: 'Subscription Tracker API — manage recurring subscriptions, payments, categories, and notifications.',
      contact: {
        name: 'Wardaya Dev',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3001}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            currency: { type: 'string', example: 'USD' },
            isAdmin: { type: 'boolean' },
            googleId: { type: 'string', nullable: true },
            avatar: { type: 'string', nullable: true },
            notifyRenewalReminders: { type: 'boolean' },
            notifyEmailReminders: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            amount: { type: 'number', example: 9.99 },
            currency: { type: 'string', example: 'USD' },
            billingCycle: { type: 'string', enum: ['weekly', 'monthly', 'quarterly', 'yearly'] },
            startDate: { type: 'string', format: 'date-time', nullable: true },
            nextBillingDate: { type: 'string', format: 'date-time' },
            categoryId: { type: 'string', format: 'uuid', nullable: true },
            website: { type: 'string', nullable: true },
            logo: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            reminderDays: { type: 'integer', example: 3 },
            notes: { type: 'string', nullable: true },
            userId: { type: 'string', format: 'uuid' },
            category: { $ref: '#/components/schemas/Category' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            color: { type: 'string', example: '#3B82F6', nullable: true },
            icon: { type: 'string', nullable: true },
            userId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            amount: { type: 'number', example: 9.99 },
            currency: { type: 'string', example: 'USD' },
            paidAt: { type: 'string', format: 'date-time' },
            subscriptionId: { type: 'string', format: 'uuid' },
            subscription: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                currency: { type: 'string' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
            type: { type: 'string', example: 'reminder' },
            read: { type: 'boolean' },
            userId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Health check' },
      { name: 'Auth', description: 'Authentication & user profile' },
      { name: 'Subscriptions', description: 'Subscription management' },
      { name: 'Categories', description: 'Category management' },
      { name: 'Payments', description: 'Payment tracking' },
      { name: 'Notifications', description: 'User notifications' },
      { name: 'Admin', description: 'Admin panel (requires admin role)' },
      { name: 'Chat', description: 'AI assistant (powered by Google Gemini)' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
