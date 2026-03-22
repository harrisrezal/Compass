import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, systemPrompt } = await req.json() as {
    messages: { role: "user" | "model"; parts: string }[];
    systemPrompt: string;
  };

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const genai = new GoogleGenerativeAI(apiKey);

  try {
    const model = genai.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({
      history: messages.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.parts }],
      })),
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.parts);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Gemini error:", message);
    return NextResponse.json({ error: `Gemini error: ${message}` }, { status: 500 });
  }
}
