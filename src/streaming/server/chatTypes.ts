export interface ChatPayload {
  channelId: string;
  sender: string;
  text: string;
  badge?: string;
}

export interface ChatBroadcast {
  id: string;
  sender: string;
  text: string;
  badge: string | null;
  timestamp: string;
}

export function buildChatBroadcast(payload: ChatPayload): ChatBroadcast | null {
  if (!payload.text || !payload.channelId) return null;
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sender: payload.sender || "Anonymous Viewer",
    text: payload.text.trim().substring(0, 300),
    badge: payload.badge || null,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
