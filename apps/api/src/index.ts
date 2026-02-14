import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import * as dotenv from 'dotenv';
import { healthRoutes } from './routes/health';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Security plugins
  await server.register(helmet, {
    contentSecurityPolicy: NODE_ENV === 'production',
  });

  await server.register(cors, {
    origin: NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || []
      : true,
    credentials: true,
  });

  // Rate limiting
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Routes
  await server.register(healthRoutes, { prefix: '/health' });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    server.log.error(error);

    const statusCode = error.statusCode || 500;
    const message = statusCode >= 500 ? 'Internal Server Error' : error.message;

    reply.status(statusCode).send({
      error: message,
      statusCode,
    });
  });

  return server;
}

async function start() {
  try {
    const server = await buildServer();

    await server.listen({ port: PORT, host: HOST });

    server.log.info(`🚀 Blueth City API running at http://${HOST}:${PORT}`);
    server.log.info(`Environment: ${NODE_ENV}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  start();
}
