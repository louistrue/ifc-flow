import { getLastLoadedModel } from "@/lib/ifc-utils";
import { countElements, sumWallArea } from "@/lib/ifc/ai-helpers";

export async function POST(req: Request) {
  const { messages, modelId } = await req.json();
  const question: string = messages?.[messages.length - 1]?.content || "";
  const model = getLastLoadedModel();

  let answer = "No IFC model connected.";
  if (model) {
    if (/how many walls/i.test(question)) {
      const count = countElements(model, "IfcWall");
      answer = `The model contains ${count} walls.`;
    } else if (/wall (area|m2|square meters)/i.test(question)) {
      const area = sumWallArea(model);
      answer = `Walls have a total area of ${area} m².`;
    } else {
      answer = "I could not understand the question.";
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: Date.now().toString(), role: 'assistant', content: answer })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}
