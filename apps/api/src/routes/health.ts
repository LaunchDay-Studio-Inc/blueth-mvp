import { FastifyPluginAsync } from 'fastify';
import { pool } from '@blueth/db';
import { APP_VERSION, GIT_COMMIT } from '../version';

export const healthRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async (_request, _reply) => {
    return {
      status: 'ok',
      version: APP_VERSION,
      commit: GIT_COMMIT,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  });

  server.get('/db', async (_request, reply) => {
    try {
      const result = await pool.query('SELECT NOW() as time');

      return {
        status: 'ok',
        database: 'connected',
        timestamp: result.rows[0].time,
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  server.get('/ready', async (_request, reply) => {
    try {
      // Check database connection
      await pool.query('SELECT 1');

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'not ready',
        reason: 'database unavailable',
      };
    }
  });
};
