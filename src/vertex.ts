import { config } from './config';
import { withRetry } from './utils/retry';

interface CallVertexPredictParams {
  authHeader: string;
  body: unknown;
}

export interface VertexCallResult {
  status: number;
  isJson: boolean;
  body: unknown;
  contentType?: string;
}

class RetryableResponseError extends Error {
  constructor(public readonly result: VertexCallResult) {
    super('Retryable Vertex response');
    this.name = 'RetryableResponseError';
  }
}

export class VertexRequestError extends Error {
  constructor(message: string, public readonly retryable = false) {
    super(message);
    this.name = 'VertexRequestError';
  }
}

const buildVertexEndpoint = () =>
  `https://${config.gcpLocation}-aiplatform.googleapis.com/v1/projects/${config.gcpProjectId}/locations/${config.gcpLocation}/publishers/google/models/${config.veoModelId}:predict`;

export async function callVertexPredict(params: CallVertexPredictParams): Promise<VertexCallResult> {
  const endpoint = buildVertexEndpoint();
  const maxRetries = 1;

  const operation = async (attempt: number): Promise<VertexCallResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: params.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params.body),
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') ?? undefined;
      const rawText = await response.text();

      let parsedBody: unknown = rawText;
      let isJson = false;

      if (contentType?.includes('application/json') && rawText) {
        try {
          parsedBody = JSON.parse(rawText);
          isJson = true;
        } catch {
          parsedBody = rawText;
          isJson = false;
        }
      }

      const result: VertexCallResult = {
        status: response.status,
        isJson,
        body: isJson ? parsedBody : rawText,
        contentType,
      };

      if ((response.status === 429 || response.status >= 500) && attempt <= maxRetries) {
        throw new RetryableResponseError(result);
      }

      return result;
    } catch (error) {
      if (error instanceof RetryableResponseError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new VertexRequestError('Request to Vertex AI timed out', true);
      }

      const message = error instanceof Error ? error.message : 'Unknown error calling Vertex AI';
      throw new VertexRequestError(message, true);
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    return await withRetry(operation, {
      retries: maxRetries,
      minDelayMs: 500,
      maxDelayMs: 1500,
      shouldRetry: (error) => error instanceof RetryableResponseError || (error instanceof VertexRequestError && error.retryable),
    });
  } catch (error) {
    if (error instanceof RetryableResponseError) {
      return error.result;
    }

    throw error;
  }
}
