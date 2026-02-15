import { createServer, IncomingMessage, ServerResponse } from 'http';
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

const INTERNAL_PORT = Number(env.PORT) + 1; // Elysia listens internally

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
    );

  // Start Elysia on internal port (with full middleware chain via Bun's server)
  app.listen(INTERNAL_PORT);
  console.log(`[Elysia] Internal server on port ${INTERNAL_PORT}`);

  // Create a Node.js HTTP server that proxies to Elysia.
  // Socket.IO requires a Node.js HTTP server — Bun's native server is not compatible.
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Proxy to Elysia's internal server
    const url = `http://localhost:${INTERNAL_PORT}${req.url || '/'}`;

    // Collect request body for non-GET/HEAD methods
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    let body: Buffer | undefined;
    if (hasBody) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      body = Buffer.concat(chunks);
    }

    // Convert Node headers to Headers object
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }
    // Remove host header to avoid mismatches
    delete headers['host'];

    try {
      const response = await fetch(url, {
        method: req.method || 'GET',
        headers,
        body: hasBody ? body : undefined,
      });

      // Write response back to Node
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      res.writeHead(response.status, responseHeaders);
      const arrayBuffer = await response.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error('[Server] Error proxying request:', error);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: { code: 'PROXY_ERROR', message: 'Failed to reach internal server' } }));
    }
  });

  // Setup Socket.IO on the Node HTTP server
  setupWebSocket(httpServer);

  // Start listening on the public port
  httpServer.listen(env.PORT, () => {
    console.log(`[AirShare] Server running at http://localhost:${env.PORT}`);
    console.log(`[AirShare] Swagger docs at http://localhost:${env.PORT}/swagger`);
    console.log(`[AirShare] Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
