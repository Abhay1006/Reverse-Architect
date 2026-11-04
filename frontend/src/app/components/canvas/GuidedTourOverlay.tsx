"use client";

import React from "react";
import { Box, Typography, Button, IconButton } from "@mui/material";
import { Close as CloseIcon, Flag as EntryIcon } from "@mui/icons-material";
import { useAtlasStore } from "../../store/atlas-store";

/**
 * A one-time hint on the graph tab pointing at the detected entry point.
 *
 * It used to select the entry node automatically on load, which switched the
 * canvas into its neighbourhood layout and dimmed everything else, so the first
 * thing users saw was two nodes and an empty screen. Now the whole graph is
 * shown and following the entry point is the user's choice.
 */
export default function GuidedTourOverlay() {
  const allNodes = useAtlasStore((s) => s.nodes);
  const entryPoint = useAtlasStore((s) => s.entryPoint);
  const activeTab = useAtlasStore((s) => s.activeTab);
  const hasGuidedTourShown = useAtlasStore((s) => s.hasGuidedTourShown);
  const setHasGuidedTourShown = useAtlasStore((s) => s.setHasGuidedTourShown);
  const revealInGraph = useAtlasStore((s) => s.revealInGraph);

  if (hasGuidedTourShown || activeTab !== "graph" || !entryPoint) return null;
  const entryNode = allNodes.find((n) => n.type === "file" && n.data?.filePath === entryPoint.entryFile);
  if (!entryNode) return null;

  const dismiss = () => setHasGuidedTourShown(true);

  return (
    <Box
      role="dialog"
      aria-label="Start here"
      sx={{
        position: "absolute",
        bottom: { xs: 16, sm: 24 },
        left: { xs: 16, sm: "auto" },
        right: { xs: 16, sm: 230 },
        zIndex: 20,
        maxWidth: { sm: 300 },
        background: "rgba(17, 17, 24, 0.92)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(99,102,241,0.35)",
        borderRadius: 3,
        p: 2,
        boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
        animation: "tourIn 0.35s ease-out",
        "@keyframes tourIn": {
          from: { transform: "translateY(12px)", opacity: 0 },
          to: { transform: "translateY(0)", opacity: 1 },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <EntryIcon sx={{ fontSize: 18, color: "#a5b4fc" }} />
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, flex: 1 }}>Start here</Typography>
        <IconButton size="small" aria-label="Dismiss" onClick={dismiss} sx={{ color: "text.secondary", mr: -0.5 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8125rem", lineHeight: 1.5, mb: 1.5 }}>
        The {entryPoint.framework !== "unknown" ? `${entryPoint.framework} ` : ""}entry point is{" "}
        <Box component="code" sx={{ fontFamily: "var(--font-geist-mono), monospace", color: "#c7d2fe" }}>
          {entryPoint.entryFile}
        </Box>
        . Click any node to see what it depends on; double-click to isolate it.
      </Typography>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          variant="contained"
          onClick={() => {
            dismiss();
            revealInGraph([entryNode.id]);
          }}
        >
          Show entry point
        </Button>
        <Button onClick={dismiss} sx={{ color: "text.secondary" }}>
          Got it, thanks!
        </Button>
      </Box>
    </Box>
  );
}
