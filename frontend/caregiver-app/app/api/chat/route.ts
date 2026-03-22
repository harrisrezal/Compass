import { VertexAI } from "@google-cloud/vertexai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, systemPrompt } = await req.json() as {
    messages: { role: "user" | "model"; parts: string }[];
    systemPrompt: string;
  };

  const project = process.env.GCP_PROJECT_ID?.trim();
  if (!project) {
    return NextResponse.json({ error: "GCP_PROJECT_ID not configured" }, { status: 500 });
  }

  try {
    const vertexAI = new VertexAI({ project, location: "us-central1" });
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    });

    const chat = model.startChat({
      history: messages.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.parts }],
      })),
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage([{ text: lastMessage.parts }]);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response";

    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Vertex AI error:", message);
    return NextResponse.json({ error: `Gemini error: ${message}` }, { status: 500 });
  }
}
