import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { callVertexPredict, VertexRequestError } from './vertex';

const app = Fastify({
  logger: {
    level: config.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        'req.headers.x-api-key',
        'res.headers.authorization',
        'req.body',
        'res.body',
      ],
      remove: true,
    },
    serializers: {
      req(request) {
        const headers = { ...request.headers };
        delete headers.authorization;
        delete headers['x-api-key'];

        return {
          method: request.method,
          url: request.url,
          headers,
          remoteAddress: request.ip,
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
  },
  trustProxy: true,
  bodyLimit: 20 * 1024 * 1024,
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({ msg: 'Unhandled error', err: { message: error.message, stack: error.stack } });
  const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
  reply.status(statusCode).send({ error: 'Internal server error' });
});

app.register(helmet);

app.register(rateLimit, {
  max: config.rateLimitPerMinute,
  timeWindow: '1 minute',
  hook: 'onRequest',
  keyGenerator: (req) => {
    const apiKeyHeader = req.headers['x-api-key'];
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim().length > 0) {
      return `key:${apiKeyHeader}`;
    }
    return `ip:${req.ip}`;
  },
});

app.get('/health', async () => ({ ok: true }));

app.post('/veo/generate', async (request, reply) => {
  const apiKeyHeader = request.headers['x-api-key'];
  if (typeof apiKeyHeader !== 'string' || apiKeyHeader !== config.proxyApiKey) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const authHeader = request.headers.authorization;
  if (typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
    return reply.status(400).send({ error: 'Missing Authorization bearer token' });
  }

  const contentType = request.headers['content-type'];
  if (typeof contentType !== 'string' || !contentType.toLowerCase().includes('application/json')) {
    return reply.status(400).send({ error: 'Content-Type must be application/json' });
  }

  if (request.body === undefined) {
    return reply.status(400).send({ error: 'Body must be JSON' });
  }

  try {
    const vertexResponse = await callVertexPredict({ authHeader, body: request.body });

    if (vertexResponse.contentType) {
      reply.header('content-type', vertexResponse.contentType);
    }

    reply.status(vertexResponse.status);
    if (vertexResponse.isJson) {
      return vertexResponse.body;
    }

    return reply.send(vertexResponse.body ?? '');
  } catch (error) {
    if (error instanceof VertexRequestError) {
      request.log.error({ msg: 'Vertex request failed', err: { message: error.message } });
      return reply.status(502).send({ error: 'Bad gateway', message: 'Failed to reach Vertex AI' });
    }

    request.log.error({ msg: 'Unexpected failure', err: { message: (error as Error).message } });
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

const start = async () => {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Proxy listening on port ${config.port}`);
  } catch (error) {
    app.log.error({ msg: 'Failed to start server', err: { message: (error as Error).message } });
    process.exit(1);
  }
};

start();
