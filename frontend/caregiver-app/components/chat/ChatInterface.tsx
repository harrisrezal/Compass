"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "model";
  parts: string;
}

const SUGGESTED_QUESTIONS = [
  "What should I do right now?",
  "How long will my backup battery last?",
  "What's the nearest cooling center?",
  "When should I call 911?",
];

interface Props {
  systemPrompt: string;
  patientName: string;
}

export default function ChatInterface({ systemPrompt, patientName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const newMessages: Message[] = [...messages, { role: "user", parts: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, systemPrompt }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "model", parts: data.text ?? data.error ?? "Sorry, something went wrong." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "model", parts: "Connection error — please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-10 space-y-4">
            <div className="text-4xl">🧭</div>
            <div>
              <p className="font-semibold text-slate-700">Compass is here to help</p>
              <p className="text-sm text-slate-400 mt-1">
                Ask anything about {patientName}&apos;s current risk or what to do next.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-sm bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 px-4 py-2 rounded-full transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
              }`}
            >
              {msg.role === "model" && (
                <span className="text-xs text-slate-400 block mb-1">🧭 Compass</span>
              )}
              {msg.parts}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
              <span className="text-xs text-slate-400 block mb-1">🧭 Compass</span>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-4 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
            placeholder="Ask anything…"
            disabled={loading}
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-200 text-white px-4 py-2.5 rounded-xl transition text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
