"use client";

import React, { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ChatBroadcast } from "../server/chatTypes";

interface WorfiLiveChatProps {
  channelId: string;
}

const CHAT_ORIGIN =
  process.env.NEXT_PUBLIC_WORFI_CHAT_URL || "http://localhost:4000";

export const WorfiLiveChat: React.FC<WorfiLiveChatProps> = ({ channelId }) => {
  const [messages, setMessages] = useState<ChatBroadcast[]>([]);
  const [viewerCount, setViewerCount] = useState(1);
  const [draft, setDraft] = useState("");
  const [sender] = useState("Viewer");
  const socketRef = useRef<Socket | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = io(CHAT_ORIGIN, {
      path: "/v1/chat/ws",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    socketRef.current = socket;

    const join = () => socket.emit("JOIN_ROOM", { channelId });
    socket.on("connect", join);
    join();

    socket.on("NEW_MESSAGE", (msg: ChatBroadcast) => {
      setMessages((prev) => [...prev.slice(-99), msg]);
    });
    socket.on("VIEWER_COUNT_UPDATE", ({ viewerCount: count }: { viewerCount: number }) => {
      setViewerCount(count);
    });
    socket.on("connect_error", () => {
      // Broadcast server is optional when running Next-only.
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [channelId]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const payload = { channelId, sender, text };
    if (socketRef.current?.connected) {
      socketRef.current.emit("SEND_MESSAGE", payload);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${crypto.randomUUID()}`,
          sender,
          text: text.substring(0, 300),
          badge: null,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    }
    setDraft("");
  };

  return (
    <aside className="flex h-full w-[min(100vw,20rem)] flex-col border-l border-blue-900/60 bg-slate-950 font-mono text-slate-100">
      <header className="flex items-center justify-between border-b border-blue-900/60 px-4 py-3">
        <div>
          <div className="text-[10px] font-black tracking-widest text-yellow-400 uppercase">
            Worfi Live Chat
          </div>
          <div className="truncate text-xs text-slate-400">{channelId}</div>
        </div>
        <div className="text-[10px] font-bold text-cyan-400">
          {viewerCount} watching
        </div>
      </header>
      <div ref={scrollerRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            No messages yet. Say something about the set.
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-xs">
              <span className="text-[10px] text-slate-500">{msg.timestamp}</span>{" "}
              <span className="font-bold text-yellow-300">{msg.sender}</span>
              {msg.badge ? (
                <span className="ml-1 rounded bg-blue-900 px-1 text-[9px] text-cyan-300">
                  {msg.badge}
                </span>
              ) : null}
              <div className="text-slate-200">{msg.text}</div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={send} className="border-t border-blue-900/60 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          placeholder="Send a message…"
          className="w-full rounded-lg border border-blue-900/60 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-yellow-500"
        />
      </form>
    </aside>
  );
};
