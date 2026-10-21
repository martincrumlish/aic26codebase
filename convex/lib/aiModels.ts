// convex/lib/aiModels.ts — the models the chat offers. Shared by the backend
// (only these can be used, so nobody runs an expensive model on your app key)
// and the chat's model picker.
//
// Ids are OpenRouter model ids: browse https://openrouter.ai/models and copy
// the id (e.g. "anthropic/claude-sonnet-5.5"). Put the cheapest sensible one
// first; it's the default.
export const AI_MODELS = [
  { id: "anthropic/claude-haiku-5.5", name: "Claude Haiku 5.5", note: "Fast and cheap" },
  { id: "anthropic/claude-sonnet-5.5", name: "Claude Sonnet 5.5", note: "Smarter" },
  { id: "openai/gpt-6.1-sol", name: "GPT-6.1 Sol", note: "OpenAI" },
  { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash", note: "Google" },
  { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", note: "Very cheap" },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export const DEFAULT_MODEL: AiModelId = AI_MODELS[0].id;

export function isAllowedModel(id: string): id is AiModelId {
  return AI_MODELS.some((m) => m.id === id);
}
