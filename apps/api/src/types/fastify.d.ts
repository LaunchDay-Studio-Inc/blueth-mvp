import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    player?: {
      id: string;
      username: string;
    };
  }
}
