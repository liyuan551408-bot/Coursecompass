const ZHIPU_URL = process.env.ZHIPU_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const DEFAULT_TIMEOUT_MS = 45000;
const MAX_RETRIES = 1;
const CHAT_MODEL = process.env.ZHIPU_CHAT_MODEL || 'glm-4';

const chatCompletion = async ({ messages, temperature = 0.3, maxTokens }) => {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) throw new Error('ZHIPU_API_KEY is not configured');

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
        try {
            const response = await fetch(ZHIPU_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: CHAT_MODEL,
                    messages,
                    temperature,
                    ...(Number.isInteger(maxTokens) && maxTokens > 0 ? { max_tokens: maxTokens } : {})
                }),
                signal: controller.signal
            });
            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                const error = new Error(`Zhipu returned non-JSON response (${response.status})`);
                error.statusCode = response.status;
                throw error;
            }
            if (!response.ok) {
                const error = new Error(`Zhipu chat completion failed (${response.status})`);
                error.statusCode = response.status;
                throw error;
            }
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error('Zhipu chat completion returned empty content');
            return content;
        } catch (error) {
            const retryable = error.name === 'AbortError'
                || error.statusCode === 429
                || (error.statusCode >= 500 && error.statusCode < 600);
            if (!retryable || attempt === MAX_RETRIES) {
                if (error.name === 'AbortError') error.code = 'LLM_TIMEOUT';
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        } finally {
            clearTimeout(timeout);
        }
    }
};

module.exports = { chatCompletion };
