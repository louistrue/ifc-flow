import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getLastLoadedModel } from "@/lib/ifc-utils";
import { countElements } from "@/lib/ai/model-helpers";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(req: Request) {
  const { messages = [], modelId } = await req.json();
  const model = getLastLoadedModel();
  const wallCount = countElements(model, "IfcWall");
  const systemMsg = `The current model contains ${wallCount} walls.`;

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    messages: [{ role: "system", content: systemMsg }, ...messages],
  });

  return result.toAIStreamResponse();
}
