const EMBEDDING_DIMENSIONS = 1024;

const SILICONFLOW_EMBEDDING_URL =
  process.env.SILICONFLOW_EMBEDDING_URL ||
  'https://api.siliconflow.cn/v1/embeddings';

const SILICONFLOW_EMBEDDING_MODEL =
  process.env.SILICONFLOW_EMBEDDING_MODEL ||
  'BAAI/bge-m3';
const EMBEDDING_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

const generateEmbedding = async (text) => {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new TypeError('Embedding input must be a non-empty string');
  }

  const apiKey = process.env.SILICONFLOW_API_KEY;

  if (!apiKey) {
    throw new Error('SILICONFLOW_API_KEY is not configured');
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);
    try {
    const response = await fetch(SILICONFLOW_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: SILICONFLOW_EMBEDDING_MODEL,
        input: text,
        encoding_format: 'float'
      }),
      signal: controller.signal
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        `SiliconFlow returned non-JSON response (${response.status}): ${responseText}`
      );
    }

    if (!response.ok) {
      const error = new Error(
        `SiliconFlow embedding request failed (${response.status}): ${JSON.stringify(data)}`
      );
      error.statusCode = response.status;
      error.providerCode = data?.code;
      throw error;
    }

    const vector = data?.data?.[0]?.embedding;

    if (!Array.isArray(vector)) {
      throw new Error(
        `SiliconFlow API returned an unexpected format: ${JSON.stringify(data)}`
      );
    }

    // Query and stored vectors must match the database's 1024-dimensional embedding space.
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected a ${EMBEDDING_DIMENSIONS}-dimensional embedding, got ${vector.length}`
      );
    }

    console.log(`[Embedding] Generated ${vector.length}-dimensional vector with ${data.model || SILICONFLOW_EMBEDDING_MODEL}`);

    return vector;
    } catch (error) {
      // Retry transient timeouts, throttling, and server errors; other failures need intervention.
      const retryable = error.name === 'AbortError' || error.message.includes('(429)') || error.message.includes('(5');
      if (!retryable || attempt === MAX_RETRIES) {
        console.error('Failed to call SiliconFlow embedding API:', error.message);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
};

module.exports = {
  generateEmbedding,
  EMBEDDING_DIMENSIONS
};
