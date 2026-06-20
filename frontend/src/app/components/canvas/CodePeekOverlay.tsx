"use client";

import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { Code as CodeIcon } from "@mui/icons-material";
import { useAtlasStore } from "../../store/atlas-store";

export default function CodePeekOverlay() {
  const selectedNodeId = useAtlasStore((s) => s.selectedNodeId);
  const activeRepoId = useAtlasStore((s) => s.activeRepoId);
  const allNodes = useAtlasStore((s) => s.nodes);
  const setCodePeekFile = useAtlasStore((s) => s.setCodePeekFile);

  if (!selectedNodeId || !activeRepoId) return null;

  const selectedNode = allNodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode?.data?.filePath) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        top: 80,
        right: 20,
        zIndex: 1000,
        background: "rgba(10, 10, 12, 0.85)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 2.5,
        px: 2,
        py: 1,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
      }}
    >
      <Typography
        sx={{
          color: "rgba(255,255,255,0.7)",
          fontSize: "0.75rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 200,
        }}
      >
        Selected: <b>{selectedNode.data.label}</b>
      </Typography>
      <Button
        size="small"
        variant="contained"
        onClick={() => {
          setCodePeekFile({
            filePath: selectedNode.data.filePath,
            label: selectedNode.data.label,
          });
        }}
        startIcon={<CodeIcon sx={{ fontSize: 10 }} />}
        sx={{
          fontSize: "0.6875rem",
          py: 0.25,
          px: 1.5,
          borderRadius: 2,
          textTransform: "none",
          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
          "&:hover": {
            background: "linear-gradient(135deg, #4338ca, #6d28d9)",
          },
        }}
      >
        Peek Code
      </Button>
    </Box>
  );
}
