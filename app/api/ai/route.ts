import { NextRequest } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { countElements, sumWallArea, getCachedModel } from "@/lib/ifc/ai-helpers";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { messages, modelId } = await req.json();
  const prompt = messages?.[messages.length - 1]?.content || "";

  if (modelId) {
    const model = getCachedModel(modelId);
    if (model) {
      const lower = prompt.toLowerCase();
      if (lower.includes("how many walls")) {
        const count = countElements(model, "IfcWall");
        return new Response(`There are ${count} walls in the model.`);
      }
      if (lower.includes("wall") && lower.includes("m") && lower.includes("area")) {
        const area = sumWallArea(model);
        return new Response(`Total wall area is ${area} m².`);
      }
    }
  }

  const response = await streamText({
    model: openai("gpt-3.5-turbo"),
    messages,
  });
  return response.toDataStreamResponse();
}
