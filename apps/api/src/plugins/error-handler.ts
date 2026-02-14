import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { DomainError } from '@blueth/core';

const errorHandlerPluginImpl: FastifyPluginAsync = async (server) => {
  server.setErrorHandler((error, _request, reply) => {
    // DomainError subclasses: use their code and statusCode
    if (error instanceof DomainError) {
      server.log.warn({ code: error.code, message: error.message }, 'Domain error');
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
    }

    // Fastify validation errors (from schema validation)
    if (error.validation) {
      return reply.status(400).send({
        error: error.message,
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
    }

    // Unexpected errors: log full stack, return generic message
    server.log.error(error);
    const statusCode = error.statusCode ?? 500;
    const message = statusCode >= 500 ? 'Internal Server Error' : error.message;
    return reply.status(statusCode).send({
      error: message,
      code: 'INTERNAL_ERROR',
      statusCode,
    });
  });
};

export const errorHandlerPlugin = fp(errorHandlerPluginImpl, {
  name: 'error-handler-plugin',
  fastify: '4.x',
});
