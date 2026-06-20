"use client";

import React, { memo, ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, Typography } from "@mui/material";
import { useAtlasStore } from "../../store/atlas-store";

interface BaseNodeProps {
  label: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  headerColor?: string;
  selected?: boolean;
  status?: "god" | "dead" | "entry" | "default";
  complexity?: number;
  sourcePosition?: Position;
  targetPosition?: Position;
}

const BaseNode = ({
  label,
  icon,
  children,
  className = "",
  headerColor = "var(--primary)",
  selected = false,
  status = "default",
  complexity,
  sourcePosition,
  targetPosition,
}: BaseNodeProps) => {
  const heatmapEnabled = useAtlasStore((s) => s.heatmapEnabled);

  const getBackgroundStyle = () => {
    if (status === "god") {
      return `linear-gradient(145deg, rgba(239, 68, 68, 0.35) 0%, rgba(15, 15, 20, 0.98) 120%)`;
    }
    if (status === "dead") {
      return `linear-gradient(145deg, rgba(148, 163, 184, 0.15) 0%, rgba(15, 15, 20, 0.98) 120%)`;
    }
    if (status === "entry") {
      return `linear-gradient(145deg, rgba(99, 102, 241, 0.25) 0%, rgba(15, 15, 20, 0.98) 120%)`;
    }
    if (heatmapEnabled && complexity !== undefined) {
      const hue = Math.max(0, 120 - complexity * 8); // 120 = green, 0 = red
      const sat = Math.min(100, 35 + complexity * 3.5);
      const color = `hsl(${hue}, ${sat}%, 20%)`;
      return `linear-gradient(145deg, color-mix(in srgb, ${color} 45%, transparent) 0%, rgba(15, 15, 20, 0.98) 120%)`;
    }
    return `linear-gradient(145deg, color-mix(in srgb, ${headerColor} 25%, transparent) 0%, rgba(15, 15, 20, 0.98) 120%)`;
  };

  const getBorderColor = () => {
    if (status === "god") return "rgba(239, 68, 68, 0.8)";
    if (status === "dead") return "rgba(148, 163, 184, 0.3)";
    if (status === "entry") return "var(--primary)";
    if (heatmapEnabled && complexity !== undefined) {
      const hue = Math.max(0, 120 - complexity * 8);
      const sat = Math.min(100, 35 + complexity * 3.5);
      return `hsl(${hue}, ${sat}%, 45%)`;
    }
    return selected ? headerColor : "rgba(255, 255, 255, 0.1)";
  };

  const borderGlow = () => {
    if (selected) {
      if (status === "god") return "0 0 16px rgba(239, 68, 68, 0.4)";
      if (status === "entry") return "0 0 16px rgba(99, 102, 241, 0.4)";
      return `0 0 16px ${headerColor}`;
    }
    return "none";
  };

  return (
    <Box
      className={`${className} group`}
      sx={{
        background: getBackgroundStyle(),
        border: `1.5px solid ${getBorderColor()}`,
        borderRadius: "14px",
        boxShadow: borderGlow(),
        width: 350,
        color: "white",
        fontFamily: "Outfit, sans-serif",
        position: "relative",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
        backdropFilter: "blur(8px)",
        overflow: "visible", // Enable handles to render outside boundaries safely
        "&:hover": {
          borderColor: status === "god" ? "rgba(239, 68, 68, 1)" :
                       status === "dead" ? "rgba(148, 163, 184, 0.5)" :
                       status === "entry" ? "var(--primary)" :
                       headerColor,
          transform: "translateY(-2px)",
        },
      }}
    >
      {/* Node Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 2,
          pb: 1.5,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          bgcolor: "rgba(255,255,255,0.02)",
          borderTopLeftRadius: "13px",
          borderTopRightRadius: "13px",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: "8px",
            bgcolor: "rgba(255,255,255,0.04)",
            color: headerColor,
          }}
        >
          {icon}
        </Box>
        <Typography
          sx={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "rgba(255,255,255,0.9)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
      </Box>

      {/* Node Content */}
      <Box sx={{ px: 2, py: 1.5, minHeight: 40 }}>
        {children}
      </Box>

      {/* Connection Handles */}
      <Handle
        type="target"
        position={targetPosition ?? Position.Left}
        className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-[#17171a]"
      />
      <Handle
        type="source"
        position={sourcePosition ?? Position.Right}
        className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-[#17171a]"
      />
    </Box>
  );
};

export default memo(BaseNode);
