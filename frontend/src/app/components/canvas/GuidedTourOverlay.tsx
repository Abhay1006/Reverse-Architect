"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { useAtlasStore } from "../../store/atlas-store";

export default function GuidedTourOverlay() {
  const allNodes = useAtlasStore((s) => s.nodes);
  const entryPoint = useAtlasStore((s) => s.entryPoint);
  const hasGuidedTourShown = useAtlasStore((s) => s.hasGuidedTourShown);
  const setHasGuidedTourShown = useAtlasStore((s) => s.setHasGuidedTourShown);
  const panToNode = useAtlasStore((s) => s.panToNode);

  const [showTourOverlay, setShowTourOverlay] = useState(false);

  // Auto-focus entry point on first load
  useEffect(() => {
    if (allNodes.length > 0 && !hasGuidedTourShown && entryPoint) {
      const entryNode = allNodes.find(
        (n) => n.data?.filePath === entryPoint.entryFile && n.type === "file"
      );
      if (entryNode) {
        // Give time for the graph to render and layout
        setTimeout(() => {
          panToNode(entryNode.id);
          setShowTourOverlay(true);
          setHasGuidedTourShown(true);
        }, 1500);
      }
    }
  }, [allNodes, entryPoint, hasGuidedTourShown, panToNode, setHasGuidedTourShown]);

  if (!showTourOverlay) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 40,
        right: 40,
        zIndex: 2000,
        width: 280,
        background:
          "linear-gradient(135deg, rgba(79, 70, 229, 0.95), rgba(124, 58, 237, 0.95))",
        backdropFilter: "blur(10px)",
        borderRadius: 4,
        p: 3,
        boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
        animation: "slideUp 0.5s ease-out",
        "@keyframes slideUp": {
          from: { transform: "translateY(20px)", opacity: 0 },
          to: { transform: "translateY(0)", opacity: 1 },
        },
      }}
    >
      <Typography sx={{ color: "white", fontSize: "1rem", fontWeight: 800, mb: 1 }}>
        🎯 Start Here
      </Typography>
      <Typography
        sx={{
          color: "rgba(255,255,255,0.8)",
          fontSize: "0.8125rem",
          lineHeight: 1.5,
          mb: 2,
        }}
      >
        We've detected the <b>{entryPoint?.framework}</b> entry point at{" "}
        <code>{entryPoint?.entryFile}</code>. Follow the arrows to see how the code
        flows!
      </Typography>
      <Button
        fullWidth
        onClick={() => setShowTourOverlay(false)}
        sx={{
          bgcolor: "white",
          color: "#4f46e5",
          fontWeight: 700,
          fontSize: "0.75rem",
          borderRadius: 2,
          "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
        }}
      >
        Got it, thanks!
      </Button>
    </Box>
  );
}
