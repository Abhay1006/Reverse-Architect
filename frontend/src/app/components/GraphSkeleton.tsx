"use client";

import React from "react";
import { Box, Typography } from "@mui/material";

const SKELETON_NODES = [
  { w: 280, h: 140, x: 60, y: 40, delay: 0 },
  { w: 320, h: 160, x: 400, y: 60, delay: 0.1 },
  { w: 240, h: 120, x: 180, y: 260, delay: 0.2 },
  { w: 300, h: 150, x: 560, y: 280, delay: 0.3 },
  { w: 260, h: 130, x: 80, y: 440, delay: 0.4 },
  { w: 290, h: 145, x: 420, y: 460, delay: 0.5 },
];

const SKELETON_EDGES = [
  { x1: 200, y1: 140, x2: 400, y2: 120 },
  { x1: 340, y1: 180, x2: 300, y2: 260 },
  { x1: 560, y1: 200, x2: 620, y2: 280 },
  { x1: 300, y1: 320, x2: 420, y2: 460 },
  { x1: 200, y1: 380, x2: 150, y2: 440 },
];

export default function GraphSkeleton() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        bgcolor: "#0a0a0c",
      }}
    >
      {/* Skeleton graph preview */}
      <Box sx={{ position: "relative", width: "100%", maxWidth: 900, height: 600, mx: "auto" }}>
        {/* Fake edges */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.15,
          }}
        >
          {SKELETON_EDGES.map((e, i) => (
            <line
              key={i}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke="rgba(99,102,241,0.6)"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          ))}
        </svg>

        {/* Fake nodes */}
        {SKELETON_NODES.map((node, i) => (
          <Box
            key={i}
            className="skeleton-block"
            sx={{
              position: "absolute",
              left: node.x,
              top: node.y,
              width: node.w,
              height: node.h,
              animationDelay: `${node.delay}s`,
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            {/* Title bar */}
            <Box
              sx={{
                height: 28,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                display: "flex",
                alignItems: "center",
                px: 1.5,
                gap: 1,
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "rgba(99,102,241,0.3)" }} />
              <Box sx={{ width: 60 + i * 15, height: 8, borderRadius: 4, bgcolor: "rgba(255,255,255,0.06)" }} />
            </Box>
            {/* Content lines */}
            <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 0.8 }}>
              {Array.from({ length: 2 + (i % 3) }).map((_, j) => (
                <Box
                  key={j}
                  sx={{
                    width: `${50 + ((i + j) * 17) % 40}%`,
                    height: 6,
                    borderRadius: 3,
                    bgcolor: "rgba(255,255,255,0.04)",
                  }}
                />
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Loading text */}
      <Typography
        sx={{
          color: "text.secondary",
          fontSize: "0.8125rem",
          mt: 4,
          animation: "fadeInUp 0.5s ease-out",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: "primary.main",
            animation: "pulse-red 1.5s infinite",
            boxShadow: "0 0 8px rgba(99,102,241,0.5)",
          }}
        />
        Building architecture graph...
      </Typography>
    </Box>
  );
}
