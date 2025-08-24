import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, generateText } from "ai";
import { getLastLoadedModel } from "@/lib/ifc-utils";
import { countElements } from "@/lib/ai/model-helpers";



export async function POST(req: Request) {
  const { messages = [], modelId, model: selectedModel } = await req.json();
  const model = getLastLoadedModel();
  const wallCount = countElements(model, "IfcWall");
  const systemMsg = `The current model contains ${wallCount} walls.`;

  if (!process.env.OPENROUTER_API_KEY) {
    return new Response("OpenRouter API key not configured", { status: 500 });
  }

  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

  // Resolve UI id/name to OpenRouter slug; prefer explicit slugs
  const resolveOpenRouterModel = (id?: string) => {
    if (!id) return "openai/gpt-4o-mini";
    if (id.includes("/")) return id; // already a provider/model slug
    const normalized = id.toLowerCase().replace(/\s+/g, "");
    switch (normalized) {
      case "gpt5mini":
      case "gpt-5-mini":
      case "gpt_5_mini":
        return "openai/gpt-5-mini";
      case "gpt-4o-mini":
      case "gpt4omini":
        return "openai/gpt-4o-mini";
      case "gpt-4.1-mini":
      case "gpt41mini":
        return "openai/gpt-4.1-mini";
      case "gpt-4.1-nano":
      case "gpt41nano":
        return "openai/gpt-4.1-nano";
      case "gpt-4-turbo":
      case "gpt4turbo":
        return "openai/gpt-4-turbo";
      case "gpt-4-turbo-preview":
      case "gpt4turbopreview":
        return "openai/gpt-4-turbo-preview";
      case "gpt-3.5-turbo":
      case "gpt35turbo":
        return "openai/gpt-4o-mini"; // sensible default upgrade
      default:
        return "openai/gpt-4o-mini";
    }
  };

  const requested = (typeof selectedModel === 'string' && selectedModel) || (typeof modelId === 'string' && modelId) || undefined;
  const modelSlug = resolveOpenRouterModel(requested);

  const result = await generateText({
    model: openrouter.chat(modelSlug),
    messages: [{ role: "system", content: systemMsg }, ...messages],
  });

  return new Response(result.text);
}
