import { useState } from "react";
import { streamAi } from "./streamAi";
import type { ChatMessage } from "./types";

/** Q&A chat state: history, the reply currently streaming, and sending. */
export function useAiChat(repoUrl: string) {
  const [chatMessage, setChatMessage] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [streamingReply, setStreamingReply] = useState<string>("");

  const sendChat = async () => {
    if (!chatMessage.trim() || isChatLoading) return;

    const userMsg = chatMessage.trim();
    setChatMessage("");
    setChatHistory((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);
    setStreamingReply("");

    // Accumulate locally. Reading `streamingReply` in the onDone callback below
    // reads the value captured when this function was created — always "" —
    // which stored every completed reply as an empty message.
    let accumulated = "";

    await streamAi(
      "/api/ai/chat",
      {
        message: userMsg,
        repoUrl,
        history: chatHistory,
      },
      {
        onChunk: (chunk) => {
          accumulated += chunk;
          setStreamingReply((prev) => prev + chunk);
        },
        onDone: () => {
          if (accumulated) {
            setChatHistory((prev) => [...prev, { role: "assistant", content: accumulated }]);
          }
          setStreamingReply("");
          setIsChatLoading(false);
        },
        onError: (err) => {
          // Keep whatever streamed before the failure rather than discarding it.
          setChatHistory((prev) => [
            ...prev,
            {
              role: "assistant",
              content: accumulated ? `${accumulated}\n\n❌ Error: ${err.message}` : `❌ Error: ${err.message}`,
            },
          ]);
          setStreamingReply("");
          setIsChatLoading(false);
        },
      },
    );
  };

  const reset = () => {
    setChatHistory([]);
    setStreamingReply("");
  };

  return { chatMessage, setChatMessage, chatHistory, isChatLoading, streamingReply, sendChat, reset };
}
