"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  IconButton,
  CircularProgress,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  Avatar,
  Alert,
  Tooltip,
} from "@mui/material";
import {
  Send as SendIcon,
  VpnKey as KeyIcon,
  SmartToy as RobotIcon,
  BugReport as BugIcon,
  Build as BuildIcon,
  Person as PersonIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useAtlasStore } from "../store/atlas-store";
import { Highlight, themes } from "prism-react-renderer";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  created_at: string;
  labels: Array<{ name: string; color: string }>;
  user: {
    login: string;
    avatar_url: string;
  };
}

export default function AiAssistantTab() {
  const activeRepoId = useAtlasStore((state) => state.activeRepoId);

  // Configuration state (Session-only)
  const [apiKey, setApiKey] = useState<string>("");
  const [provider, setProvider] = useState<string>("openai");
  const [isConfigured, setIsConfigured] = useState<boolean>(false);

  // Tab State
  const [subTab, setSubTab] = useState<number>(0);

  // Q&A Chat State
  const [chatMessage, setChatMessage] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [streamingReply, setStreamingReply] = useState<string>("");

  // Issues State
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [areIssuesLoading, setAreIssuesLoading] = useState<boolean>(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [fixSuggestion, setFixSuggestion] = useState<string>("");
  const [isFixLoading, setIsFixLoading] = useState<boolean>(false);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load configured keys from sessionStorage on mount
  useEffect(() => {
    const savedKey = sessionStorage.getItem("atlas_ai_key");
    const savedProvider = sessionStorage.getItem("atlas_ai_provider");
    if (savedKey && savedProvider) {
      setApiKey(savedKey);
      setProvider(savedProvider);
      setIsConfigured(true);
    }
  }, []);

  // Fetch GitHub Issues when moving to issues tab and a repo is selected
  useEffect(() => {
    if (subTab === 1 && isConfigured && activeRepoId && !activeRepoId.startsWith("upload-")) {
      void fetchIssues();
    }
    // fetchIssues is stable for a given activeRepoId, which is already a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, activeRepoId, isConfigured]);

  // Scroll to bottom of chat when streaming reply or chat history changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, streamingReply]);

  const getRepoUrl = () => {
    if (!activeRepoId) return "";
    if (activeRepoId.startsWith("upload-")) {
      return `local://${activeRepoId}`;
    }
    return `https://github.com/${activeRepoId}`;
  };

  const handleSaveConfig = () => {
    if (!apiKey.trim()) return;
    sessionStorage.setItem("atlas_ai_key", apiKey.trim());
    sessionStorage.setItem("atlas_ai_provider", provider);
    setIsConfigured(true);
  };

  const handleDisconnect = () => {
    sessionStorage.removeItem("atlas_ai_key");
    sessionStorage.removeItem("atlas_ai_provider");
    setApiKey("");
    setIsConfigured(false);
    setChatHistory([]);
    setStreamingReply("");
    setSelectedIssue(null);
    setFixSuggestion("");
  };

  // Fetch public GitHub issues
  const fetchIssues = async () => {
    if (!activeRepoId || activeRepoId.startsWith("upload-")) return;
    setAreIssuesLoading(true);
    setIssuesError(null);
    try {
      const url = `/api/ai/issues?repoUrl=${encodeURIComponent(getRepoUrl())}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch public repo issues");
      }
      const data = await res.json();
      setIssues(data.issues || []);
    } catch (err: unknown) {
      console.error(err);
      setIssuesError(
        err instanceof Error ? err.message : "Could not retrieve open issues."
      );
    } finally {
      setAreIssuesLoading(false);
    }
  };

  // Common stream reading loop
  const executeStream = async (
    url: string,
    body: object,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (err: Error) => void
  ) => {
    const savedKey = sessionStorage.getItem("atlas_ai_key") || "";
    const savedProvider = sessionStorage.getItem("atlas_ai_provider") || "";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-api-key": savedKey,
          "x-ai-provider": savedProvider,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: "Unknown connection error" }));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream response is not readable");

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("data:")) {
            const dataText = trimmed.substring(5).trim();
            if (dataText === "[DONE]") {
              onDone();
              return;
            }
            let parsed: { error?: string; text?: string };
            try {
              parsed = JSON.parse(dataText);
            } catch {
              // Not JSON — ignore this frame rather than aborting the stream.
              continue;
            }
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              onChunk(parsed.text);
            }
          }
        }
      }
      onDone();
    } catch (err: unknown) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Send a chat message
  const handleSendChat = async () => {
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

    await executeStream(
      "/api/ai/chat",
      {
        message: userMsg,
        repoUrl: getRepoUrl(),
        history: chatHistory,
      },
      (chunk) => {
        accumulated += chunk;
        setStreamingReply((prev) => prev + chunk);
      },
      () => {
        if (accumulated) {
          setChatHistory((prev) => [
            ...prev,
            { role: "assistant", content: accumulated },
          ]);
        }
        setStreamingReply("");
        setIsChatLoading(false);
      },
      (err) => {
        // Keep whatever streamed before the failure rather than discarding it.
        setChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: accumulated
              ? `${accumulated}\n\n❌ Error: ${err.message}`
              : `❌ Error: ${err.message}`,
          },
        ]);
        setStreamingReply("");
        setIsChatLoading(false);
      }
    );
  };

  // Handle fixing selected issue
  const handleFixIssue = async (issue: GitHubIssue) => {
    setFixSuggestion("");
    setIsFixLoading(true);

    await executeStream(
      "/api/ai/fix-issue",
      {
        issue: {
          number: issue.number,
          title: issue.title,
          body: issue.body,
        },
        repoUrl: getRepoUrl(),
      },
      (chunk) => {
        setFixSuggestion((prev) => prev + chunk);
      },
      () => {
        setIsFixLoading(false);
      },
      (err) => {
        setFixSuggestion((prev) => prev + `\n\n❌ Error: ${err.message}`);
        setIsFixLoading(false);
      }
    );
  };

  // Parse Markdown paragraphs & code blocks
  const parseMarkdown = (text: string) => {
    const blocks: Array<{ type: "text" | "code"; content: string; language?: string }> = [];
    const regex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        blocks.push({
          type: "text",
          content: text.substring(lastIndex, match.index),
        });
      }
      blocks.push({
        type: "code",
        language: match[1] || "typescript",
        content: match[2],
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      blocks.push({
        type: "text",
        content: text.substring(lastIndex),
      });
    }

    return blocks;
  };

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderContentWithCodeHighlighting = (text: string) => {
    const blocks = parseMarkdown(text);

    return blocks.map((block, idx) => {
      if (block.type === "code") {
        return (
          <Box
            key={idx}
            sx={{
              position: "relative",
              my: 2,
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                px: 2,
                py: 0.75,
                bgcolor: "rgba(255,255,255,0.04)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6875rem", fontFamily: "monospace" }}>
                {block.language || "code"}
              </Typography>
              <Tooltip title={copiedIndex === idx ? "Copied!" : "Copy code"}>
                <IconButton
                  size="small"
                  onClick={() => handleCopyCode(block.content, idx)}
                  sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "white" } }}
                >
                  {copiedIndex === idx ? (
                    <CheckIcon fontSize="inherit" sx={{ color: "success.main" }} />
                  ) : (
                    <CopyIcon fontSize="inherit" />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
            <Box
              sx={{
                p: 2,
                fontFamily: "monospace",
                fontSize: "0.75rem",
                overflow: "auto",
                bgcolor: "#0d1117",
              }}
            >
              <Highlight
                theme={themes.vsDark}
                code={block.content.trim()}
                language={block.language || "typescript"}
              >
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                  <pre className={className} style={{ ...style, margin: 0, background: "transparent" }}>
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })}>
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </Box>
          </Box>
        );
      } else {
        return (
          <Typography
            key={idx}
            sx={{
              whiteSpace: "pre-wrap",
              fontSize: "0.8125rem",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {block.content}
          </Typography>
        );
      }
    });
  };

  // --- 1. UNCONFIGURED STATE ---
  if (!isConfigured) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          p: 4,
          bgcolor: "#0a0a0c",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            maxWidth: 500,
            p: 4,
            borderRadius: 3,
            bgcolor: "rgba(25, 25, 30, 0.6)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Avatar sx={{ bgcolor: "info.main", width: 56, height: 56 }}>
              <KeyIcon sx={{ fontSize: 28, color: "black" }} />
            </Avatar>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ color: "white", fontWeight: 700, mb: 1 }}>
              Configure AI Key
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
              Provide your API key to enable Codebase Q&A Chat and automated Issue Fixing.
              Keys are stored <strong>only in this browser session</strong> (sessionStorage)
              and deleted automatically when you close the tab/window. They are never saved on the server.
            </Typography>
          </Box>

          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel id="provider-select-label" sx={{ color: "rgba(255,255,255,0.6)" }}>AI Provider</InputLabel>
            <Select
              labelId="provider-select-label"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              label="AI Provider"
              sx={{
                color: "white",
                ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.15)" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "info.main" },
              }}
            >
              <MenuItem value="openai">OpenAI (GPT-4o)</MenuItem>
              <MenuItem value="anthropic">Anthropic (Claude 3.5 Sonnet)</MenuItem>
              <MenuItem value="gemini">Google Gemini (Gemini 2.0 Flash)</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            type="password"
            label="API Key"
            placeholder={`Enter your ${provider === 'openai' ? 'sk-...' : provider === 'anthropic' ? 'sk-ant-...' : 'Gemini API key'}`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            size="small"
            InputLabelProps={{ style: { color: "rgba(255,255,255,0.6)" } }}
            inputProps={{ style: { color: "white" } }}
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
                "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                "&.Mui-focused fieldset": { borderColor: "info.main" },
              },
            }}
          />

          <Button
            fullWidth
            variant="contained"
            disabled={!apiKey.trim()}
            onClick={handleSaveConfig}
            sx={{
              bgcolor: "info.main",
              color: "black",
              fontWeight: 700,
              textTransform: "none",
              "&:hover": { bgcolor: "info.light" },
              "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" },
            }}
          >
            Start Q&A Session
          </Button>
        </Paper>
      </Box>
    );
  }

  // --- 2. CONFIGURED STATE ---
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "#0a0a0c",
        overflow: "hidden",
      }}
    >
      {/* Session Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 3,
          py: 1.5,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          bgcolor: "rgba(15,15,20,0.4)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <RobotIcon sx={{ color: "info.main" }} />
          <Typography sx={{ color: "white", fontSize: "0.875rem", fontWeight: 700 }}>
            AI Assistant — Session Active
          </Typography>
          <Chip
            size="small"
            label={provider.toUpperCase()}
            sx={{
              bgcolor: "rgba(34, 211, 238, 0.15)",
              color: "info.light",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          />
        </Box>
        <Button
          size="small"
          onClick={handleDisconnect}
          sx={{
            color: "rgba(255,255,255,0.4)",
            textTransform: "none",
            fontSize: "0.75rem",
            "&:hover": { color: "error.light", bgcolor: "rgba(255, 0, 0, 0.05)" },
          }}
        >
          Disconnect Session
        </Button>
      </Box>

      {/* Sub tabs: Q&A Chat vs GitHub Issues */}
      <Box sx={{ borderBottom: 1, borderColor: "rgba(255,255,255,0.06)", bgcolor: "rgba(10,10,12,0.95)" }}>
        <Tabs
          value={subTab}
          onChange={(e, v) => setSubTab(v)}
          textColor="inherit"
          indicatorColor="primary"
          sx={{ minHeight: 40 }}
        >
          <Tab label="Q&A Chat" sx={{ textTransform: "none", minHeight: 40, fontSize: "0.75rem", fontWeight: 600 }} />
          <Tab
            label="GitHub Issues Fixer"
            sx={{ textTransform: "none", minHeight: 40, fontSize: "0.75rem", fontWeight: 600 }}
          />
        </Tabs>
      </Box>

      {/* Tab Contents */}
      <Box sx={{ flex: 1, overflow: "hidden", position: "relative" }}>
        
        {/* --- TAB 0: Q&A CHAT --- */}
        {subTab === 0 && (
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
                      {renderContentWithCodeHighlighting(msg.content)}
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
                      {renderContentWithCodeHighlighting(streamingReply)}
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
                    handleSendChat();
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
                onClick={handleSendChat}
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
        )}

        {/* --- TAB 1: GITHUB ISSUES --- */}
        {subTab === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {activeRepoId && activeRepoId.startsWith("upload-") ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "rgba(255,255,255,0.4)",
                  p: 4,
                  textAlign: "center",
                }}
              >
                <BugIcon sx={{ fontSize: 40, mb: 1.5 }} />
                <Typography variant="body2" sx={{ maxWidth: 400 }}>
                  This repository was uploaded locally via a zip file. Issue Fixer is only available for analyzed public GitHub repositories.
                </Typography>
              </Box>
            ) : !selectedIssue ? (
              // Issue List View
              <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 3, py: 2, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <Typography variant="subtitle2" sx={{ color: "white", fontWeight: 700 }}>
                    Open Repository Issues
                  </Typography>
                  <IconButton size="small" onClick={fetchIssues} disabled={areIssuesLoading} sx={{ color: "rgba(255,255,255,0.6)" }}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Box>

                <Box sx={{ flex: 1, overflowY: "auto", p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {areIssuesLoading ? (
                    <Box sx={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                      <CircularProgress size={20} sx={{ color: "info.main" }} />
                      <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>
                        Retrieving open issues from GitHub...
                      </Typography>
                    </Box>
                  ) : issuesError ? (
                    <Alert severity="error" sx={{ bgcolor: "rgba(239, 68, 68, 0.1)", color: "error.light", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                      {issuesError}
                    </Alert>
                  ) : issues.length === 0 ? (
                    <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8125rem", textAlign: "center", my: 4 }}>
                      No open issues found for this repository.
                    </Typography>
                  ) : (
                    issues.map((issue) => (
                      <Card
                        key={issue.number}
                        onClick={() => setSelectedIssue(issue)}
                        sx={{
                          bgcolor: "rgba(25, 25, 30, 0.4)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            bgcolor: "rgba(25, 25, 30, 0.7)",
                            borderColor: "info.main",
                          },
                        }}
                      >
                        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1, gap: 2 }}>
                            <Typography sx={{ color: "white", fontSize: "0.875rem", fontWeight: 600 }}>
                              #{issue.number} {issue.title}
                            </Typography>
                            <Chip size="small" label="Open" color="success" variant="outlined" sx={{ height: 18, fontSize: "0.625rem" }} />
                          </Box>

                          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1.5 }}>
                            {issue.labels.map((l) => (
                              <Chip
                                key={l.name}
                                label={l.name}
                                size="small"
                                style={{
                                  backgroundColor: `#${l.color}22`,
                                  color: `#${l.color}`,
                                  border: `1px solid #${l.color}44`,
                                  fontSize: "0.625rem",
                                  height: 18,
                                }}
                              />
                            ))}
                          </Box>

                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Avatar src={issue.user.avatar_url} sx={{ width: 18, height: 18 }} />
                            <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6875rem" }}>
                              opened by {issue.user.login} on {new Date(issue.created_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </Box>
              </Box>
            ) : (
              // Issue Fix Details View
              <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 3,
                    py: 1.5,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    bgcolor: "rgba(15,15,20,0.3)",
                  }}
                >
                  <IconButton size="small" onClick={() => setSelectedIssue(null)} sx={{ color: "white" }}>
                    <BackIcon fontSize="small" />
                  </IconButton>
                  <Typography sx={{ color: "white", fontSize: "0.8125rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Issue #{selectedIssue.number}: {selectedIssue.title}
                  </Typography>
                </Box>

                {/* Details Scroll Area */}
                <Box sx={{ flex: 1, overflowY: "auto", p: 3, display: "flex", flexDirection: "column", gap: 3.5 }}>
                  {/* Issue description card */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <Typography sx={{ color: "white", fontSize: "0.8125rem", fontWeight: 700, mb: 1 }}>
                      Description
                    </Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", whiteSpace: "pre-wrap", maxHeight: 150, overflowY: "auto" }}>
                      {selectedIssue.body || "No description provided."}
                    </Typography>
                  </Paper>

                  {/* Suggest Fix Button */}
                  <Box>
                    <Button
                      variant="contained"
                      disabled={isFixLoading}
                      startIcon={isFixLoading ? <CircularProgress size={14} color="inherit" /> : <BuildIcon fontSize="small" />}
                      onClick={() => handleFixIssue(selectedIssue)}
                      sx={{
                        bgcolor: "info.main",
                        color: "black",
                        fontWeight: 700,
                        textTransform: "none",
                        fontSize: "0.8125rem",
                        "&:hover": { bgcolor: "info.light" },
                        "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" },
                      }}
                    >
                      {isFixLoading ? "Analyzing Repo and Suggesting Fix..." : "Analyze & Suggest Code Fix"}
                    </Button>
                  </Box>

                  {/* Fix suggestion display */}
                  {(fixSuggestion || isFixLoading) && (
                    <Box>
                      <Typography sx={{ color: "white", fontSize: "0.875rem", fontWeight: 700, mb: 1.5 }}>
                        AI Fix Suggestion
                      </Typography>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 3,
                          borderRadius: 2.5,
                          bgcolor: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 1.5,
                        }}
                      >
                        {fixSuggestion ? (
                          renderContentWithCodeHighlighting(fixSuggestion)
                        ) : (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <CircularProgress size={14} sx={{ color: "info.main" }} />
                            <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>
                              AI is building code suggestion...
                            </Typography>
                          </Box>
                        )}
                      </Paper>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
