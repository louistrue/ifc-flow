import { openai } from "@ai-sdk/openai";
import { streamText, generateText } from "ai";
import { getLastLoadedModel } from "@/lib/ifc-utils";
import { countElements } from "@/lib/ai/model-helpers";



export async function POST(req: Request) {
  const { messages = [], modelId } = await req.json();
  const model = getLastLoadedModel();
  const wallCount = countElements(model, "IfcWall");
  const systemMsg = `The current model contains ${wallCount} walls.`;

  const result = await generateText({
    model: openai("gpt-5-mini"),
    messages: [{ role: "system", content: systemMsg }, ...messages],
  });

  return new Response(result.text);
}
