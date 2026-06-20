"use client";

import React from "react";
import { Box, Typography, IconButton } from "@mui/material";
import {
  Close as CloseIcon,
  FilterCenterFocus as FocusIcon,
} from "@mui/icons-material";
import { useAtlasStore } from "../../store/atlas-store";

export default function FocusModeOverlay() {
  const focusedNodeId = useAtlasStore((s) => s.focusedNodeId);
  const setFocusedNode = useAtlasStore((s) => s.setFocusedNode);
  const allNodes = useAtlasStore((s) => s.nodes);

  if (!focusedNodeId) return null;

  const focusedNode = allNodes.find((n) => n.id === focusedNodeId);

  return (
    <Box
      sx={{
        position: "absolute",
        top: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "rgba(15, 15, 20, 0.8)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(99, 102, 241, 0.5)",
        borderRadius: 4,
        px: 3,
        py: 1,
        display: "flex",
        alignItems: "center",
        gap: 2,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
      }}
    >
      <FocusIcon sx={{ color: "#818cf8" }} />
      <Box>
        <Typography sx={{ color: "white", fontSize: "0.875rem", fontWeight: 700 }}>
          Isolated Focus Mode
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>
          Showing connections for {focusedNode?.data?.label || "selected node"}
        </Typography>
      </Box>
      <IconButton
        size="small"
        onClick={() => setFocusedNode(null)}
        sx={{ color: "white", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
