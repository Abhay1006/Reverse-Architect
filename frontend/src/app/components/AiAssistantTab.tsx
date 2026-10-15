"use client";

import React, { useState } from "react";
import { Box, Typography, Button, Tabs, Tab, Chip } from "@mui/material";
import { SmartToy as RobotIcon } from "@mui/icons-material";
import { useAtlasStore } from "../store/atlas-store";
import AiKeySetup from "./ai/AiKeySetup";
import ChatPanel from "./ai/ChatPanel";
import IssuesPanel from "./ai/IssuesPanel";
import { useAiConfig } from "./ai/useAiConfig";
import { useAiChat } from "./ai/useAiChat";
import { useIssueFixer } from "./ai/useIssueFixer";
import { repoUrlFor } from "./ai/types";

/**
 * AI assistant: codebase Q&A chat and a GitHub issue fixer. State lives in the
 * hooks here, so switching sub-tabs keeps the conversation.
 */
export default function AiAssistantTab() {
  const activeRepoId = useAtlasStore((state) => state.activeRepoId);
  const repoUrl = repoUrlFor(activeRepoId);

  const config = useAiConfig();
  const [subTab, setSubTab] = useState<number>(0);
  const chat = useAiChat(repoUrl);
  const issueFixer = useIssueFixer(activeRepoId, repoUrl, subTab === 1 && config.isConfigured);

  const handleDisconnect = () => {
    config.disconnect();
    chat.reset();
    issueFixer.reset();
  };

  // --- 1. UNCONFIGURED STATE ---
  if (!config.isConfigured) {
    return (
      <AiKeySetup
        apiKey={config.apiKey}
        onApiKeyChange={config.setApiKey}
        provider={config.provider}
        onProviderChange={config.setProvider}
        onSave={config.save}
      />
    );
  }

  const provider = config.provider;

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
        {subTab === 0 && <ChatPanel {...chat} />}
        {subTab === 1 && <IssuesPanel {...issueFixer} activeRepoId={activeRepoId} />}
      </Box>
    </Box>
  );
}
