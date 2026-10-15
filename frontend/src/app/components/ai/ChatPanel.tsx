"use client";

import React, { useEffect, useRef } from "react";
import { Box, Typography, TextField, Paper, IconButton, CircularProgress, Avatar } from "@mui/material";
import { Send as SendIcon, SmartToy as RobotIcon, Person as PersonIcon } from "@mui/icons-material";
import MarkdownContent from "./MarkdownContent";
import type { useAiChat } from "./useAiChat";

type ChatPanelProps = ReturnType<typeof useAiChat>;

/** Q&A chat about the analyzed repository. */
export default function ChatPanel({
  chatMessage,
  setChatMessage,
  chatHistory,
  isChatLoading,
  streamingReply,
  sendChat,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom of chat when streaming reply or chat history changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, streamingReply]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
    
    {/* Chat List */}
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        p: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2.5,
      }}
    >
      {chatHistory.length === 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "rgba(255,255,255,0.3)",
            gap: 1.5,
          }}
        >
          <RobotIcon sx={{ fontSize: 40 }} />
          <Typography variant="body2">
            Ask any question about the architecture, modules, files, or patterns.
          </Typography>
        </Box>
      )}

      {chatHistory.map((msg, i) => (
        <Box
          key={i}
          sx={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              maxWidth: "80%",
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
            }}
          >
            <Avatar
              sx={{
                width: 28,
                height: 28,
                bgcolor: msg.role === "user" ? "primary.main" : "info.main",
                color: msg.role === "user" ? "white" : "black",
              }}
            >
              {msg.role === "user" ? <PersonIcon fontSize="small" /> : <RobotIcon fontSize="small" />}
            </Avatar>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                borderTopRightRadius: msg.role === "user" ? 1 : 12,
                borderTopLeftRadius: msg.role !== "user" ? 1 : 12,
                bgcolor: msg.role === "user" ? "rgba(99, 102, 241, 0.15)" : "rgba(255, 255, 255, 0.04)",
                border: `1px solid ${msg.role === 'user' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
              }}
            >
              <MarkdownContent text={msg.content} />
            </Paper>
          </Box>
        </Box>
      ))}

      {/* Streaming reply */}
      {streamingReply && (
        <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
          <Box sx={{ display: "flex", gap: 1.5, maxWidth: "80%" }}>
            <Avatar sx={{ width: 28, height: 28, bgcolor: "info.main", color: "black" }}>
              <RobotIcon fontSize="small" />
            </Avatar>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 3,
                borderTopLeftRadius: 1,
                bgcolor: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <MarkdownContent text={streamingReply} />
            </Paper>
          </Box>
        </Box>
      )}

      {isChatLoading && !streamingReply && (
        <Box sx={{ display: "flex", gap: 1.5, pl: 1 }}>
          <CircularProgress size={16} sx={{ color: "info.main" }} />
          <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>
            AI is thinking...
          </Typography>
        </Box>
      )}

      <div ref={messagesEndRef} />
    </Box>

    {/* Chat Input */}
    <Box
      sx={{
        p: 2,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        bgcolor: "rgba(10,10,12,0.95)",
        display: "flex",
        gap: 1.5,
      }}
    >
      <TextField
        fullWidth
        multiline
        maxRows={4}
        value={chatMessage}
        onChange={(e) => setChatMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void sendChat();
          }
        }}
        placeholder="Ask something about the codebase..."
        size="small"
        InputProps={{
          style: { color: "white", fontSize: "0.8125rem" },
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "rgba(255, 255, 255, 0.02)",
            "& fieldset": { borderColor: "rgba(255, 255, 255, 0.08)" },
            "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.15)" },
            "&.Mui-focused fieldset": { borderColor: "info.main" },
          },
        }}
      />
      <IconButton
        onClick={() => void sendChat()}
        disabled={!chatMessage.trim() || isChatLoading}
        sx={{
          bgcolor: "info.main",
          color: "black",
          borderRadius: 2,
          "&:hover": { bgcolor: "info.light" },
          "&.Mui-disabled": { bgcolor: "rgba(255, 255, 255, 0.05)", color: "rgba(255, 255, 255, 0.2)" },
        }}
      >
        <SendIcon fontSize="small" />
      </IconButton>
    </Box>
  </Box>
  );
}
