import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { env, getAllowedOrigins } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimit';
import { authRoutes } from './routes/auth';
import { roomRoutes } from './routes/rooms';
import { itemRoutes } from './routes/items';
import { uploadRoutes } from './routes/upload';
import { adminRoutes } from './routes/admin';
import { setupWebSocket } from './websocket/server';

async function main() {
  // Connect to databases
  await connectDB();
  await connectRedis();
  const allowedOrigins = getAllowedOrigins();

  // Create Elysia app
  const app = new Elysia()
    .use(cors({
      origin: allowedOrigins,
      credentials: true,
    }))
    .use(swagger({
      documentation: {
        info: {
          title: 'AirShare API',
          version: '1.0.0',
          description: 'Room-based file and content sharing API',
        },
        tags: [
          { name: 'Auth', description: 'Authentication endpoints' },
          { name: 'Rooms', description: 'Room management' },
          { name: 'Items', description: 'Content items' },
          { name: 'Upload', description: 'File uploads' },
          { name: 'Admin', description: 'Administration' },
        ],
      },
    }))
    .use(errorHandler)
    .use(rateLimiter)
    .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
    .group('/api', (app) =>
      app
        .use(authRoutes)
        .use(roomRoutes)
        .use(itemRoutes)
        .use(uploadRoutes)
        .use(adminRoutes)
    )
    .listen(env.PORT);

  // Setup WebSocket server
  setupWebSocket(app.server!);

  console.log(`[AirShare] Server running at http://localhost:${env.PORT}`);
  console.log(`[AirShare] Swagger docs at http://localhost:${env.PORT}/swagger`);
  console.log(`[AirShare] Allowed CORS origins: ${allowedOrigins.join(', ')}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
