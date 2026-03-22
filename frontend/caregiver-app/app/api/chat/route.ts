import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { messages, systemPrompt } = await req.json() as {
    messages: { role: "user" | "model"; parts: string }[];
    systemPrompt: string;
  };

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const model = genai.getGenerativeModel({
      model: "gemini-1.5-pro",
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
    console.error("Gemini error:", e);
    return NextResponse.json({ error: "Failed to get response from Gemini" }, { status: 500 });
  }
}
