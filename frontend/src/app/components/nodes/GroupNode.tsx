"use client";

import React, { memo } from "react";
import { NodeProps, Node } from "@xyflow/react";
import { Box, Typography, Chip } from "@mui/material";

export type GroupNodeData = {
  label: string;
};

export type GroupNodeType = Node<GroupNodeData, "group">;

const GroupNode = ({ data, selected }: NodeProps<GroupNodeType>) => {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        borderRadius: 4,
        border: "2px",
        borderStyle: selected ? "solid" : "dashed",
        borderColor: selected ? "#6366f1" : "rgba(255,255,255,0.2)",
        transition: "all 0.3s",
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: selected
          ? "rgba(99,102,241,0.05)"
          : "rgba(255,255,255,0.01)",
        ...(selected && {
          boxShadow: "inset 0 0 50px rgba(79,70,229,0.1)",
        }),
      }}
    >
      {/* Full-width header */}
      <Box
        sx={{
          width: "100%",
          px: 3,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: selected
            ? "rgba(99,102,241,0.5)"
            : "rgba(255,255,255,0.1)",
          backdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: selected
            ? "rgba(99,102,241,0.2)"
            : "rgba(255,255,255,0.1)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography sx={{ opacity: 0.8, fontSize: "1.125rem" }}>📁</Typography>
          <Typography
            sx={{
              fontFamily: "monospace",
              fontSize: "0.875rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
              fontWeight: 700,
            }}
          >
            {data.label}
          </Typography>
        </Box>
        <Chip
          label="Directory Module"
          size="small"
          sx={{
            height: 22,
            fontSize: "0.625rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            bgcolor: "rgba(0,0,0,0.4)",
            color: "rgba(255,255,255,0.3)",
          }}
        />
      </Box>
    </Box>
  );
};

export default memo(GroupNode);
