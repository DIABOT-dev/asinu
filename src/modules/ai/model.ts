import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function simpleGenerate(opts: {
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}) {
  const { model, system, prompt, maxTokens = 120 } = opts;

  const messages: ChatCompletionMessageParam[] = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user" as const, content: prompt },
  ];

  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: maxTokens,
    messages,
  });

  const text = res.choices[0]?.message?.content?.trim() || "";
  const usage = res.usage
    ? {
        prompt_tokens: res.usage.prompt_tokens,
        completion_tokens: res.usage.completion_tokens,
        total_tokens: res.usage.total_tokens,
      }
    : undefined;

  return { text, usage };
}
