import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Provider-agnostic LLM client.
 * Supports OpenRouter and OpenAI-compatible APIs.
 */
@Injectable()
export class LlmClientService {
  constructor(private config: ConfigService) {}

  /** Send a prompt to the configured LLM and return the response text */
  async complete(prompt: string): Promise<string> {
    const provider = this.config.get('LLM_PROVIDER') || 'openrouter';
    const model = this.config.get('LLM_MODEL') || 'deepseek/deepseek-chat';
    const apiKey = this.config.get('LLM_API_KEY');

    if (!apiKey) {
      throw new Error('LLM_API_KEY not configured. Set it in .env to enable AI suggestions.');
    }

    const baseUrl = provider === 'openai'
      ? 'https://api.openai.com/v1'
      : 'https://openrouter.ai/api/v1';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(provider === 'openrouter' ? { 'HTTP-Referer': 'sql-sandbox' } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`LLM API error (${res.status}): ${body.slice(0, 200)}`);
      }

      const data = (await res.json()) as any;
      return data.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(timeout);
    }
  }
}
