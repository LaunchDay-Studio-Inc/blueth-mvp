import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import * as dotenv from 'dotenv';
import { closePool } from '@blueth/db';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { playerRoutes } from './routes/player';
import { actionRoutes } from './routes/actions';
import { marketRoutes } from './routes/market';
import { businessRoutes } from './routes/business';
import { authPlugin } from './plugins/auth';
import { errorHandlerPlugin } from './plugins/error-handler';
import { registerAllHandlers } from './handlers/register-all';
import { validateConfig } from './config';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug'),
    },
    bodyLimit: 1_048_576, // 1 MiB
  });

  // 1. Security plugins
  await server.register(helmet, {
    contentSecurityPolicy: NODE_ENV === 'production',
    strictTransportSecurity: NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
  });

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  const corsOrigin = NODE_ENV === 'production'
    ? (origin: string | undefined, cb: (err: Error | null, origin: string | boolean) => void) => {
        if (!origin) return cb(null, true);
        const allowed = allowedOrigins.some((pattern) => {
          if (pattern.startsWith('*.')) {
            const suffix = pattern.slice(1); // e.g. ".itch.io"
            return origin.endsWith(suffix) || origin === `https://${pattern.slice(2)}`;
          }
          return origin === pattern;
        });
        cb(null, allowed ? origin : false);
      }
    : true as const;
  await server.register(cors, {
    origin: corsOrigin as any,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // 2. Auth plugin (cookie parsing + session middleware)
  await server.register(authPlugin);

  // 3. Error handler (DomainError-aware)
  await server.register(errorHandlerPlugin);

  // 4. Routes
  await server.register(healthRoutes, { prefix: '/health' });
  await server.register(authRoutes, { prefix: '/auth' });
  await server.register(playerRoutes, { prefix: '/me' });
  await server.register(actionRoutes, { prefix: '/actions' });
  await server.register(marketRoutes, { prefix: '/market' });
  await server.register(businessRoutes, { prefix: '/business' });

  // 5. Register all action handlers
  registerAllHandlers();

  return server;
}

async function start() {
  try {
    validateConfig();
    const server = await buildServer();

    await server.listen({ port: PORT, host: HOST });

    server.log.info(`Blueth City API running at http://${HOST}:${PORT}`);
    server.log.info(`Environment: ${NODE_ENV}`);

    // Graceful shutdown
    const shutdown = async () => {
      server.log.info('Shutting down gracefully...');
      await server.close();
      await closePool();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
