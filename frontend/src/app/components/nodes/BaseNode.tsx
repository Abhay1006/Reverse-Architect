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
  iconColor?: string;
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
  iconColor,
  selected = false,
  status = "default",
  complexity,
  sourcePosition,
  targetPosition,
}: BaseNodeProps) => {
  const heatmapEnabled = useAtlasStore((s) => s.heatmapEnabled);

  const getBackgroundStyle = () => {
    if (status === "god") {
      return `linear-gradient(145deg, rgba(239, 68, 68, 0.18) 0%, rgba(10, 10, 12, 0.95) 100%)`;
    }
    if (status === "dead") {
      return `linear-gradient(145deg, color-mix(in srgb, color-mix(in srgb, ${headerColor} 10%, #94a3b8) 8%, transparent) 0%, rgba(10, 10, 12, 0.98) 100%)`;
    }
    if (status === "entry") {
      return `linear-gradient(145deg, rgba(99, 102, 241, 0.15) 0%, rgba(10, 10, 12, 0.95) 100%)`;
    }
    if (heatmapEnabled && complexity !== undefined) {
      const hue = Math.max(0, 120 - complexity * 8); // 120 = green, 0 = red
      const sat = Math.min(100, 35 + complexity * 3.5);
      const color = `hsl(${hue}, ${sat}%, 20%)`;
      return `linear-gradient(145deg, color-mix(in srgb, ${color} 20%, transparent) 0%, rgba(10, 10, 12, 0.95) 100%)`;
    }
    return `linear-gradient(145deg, color-mix(in srgb, ${headerColor} 15%, transparent) 0%, rgba(10, 10, 12, 0.96) 100%)`;
  };

  const getBorderColor = () => {
    if (status === "god") return selected ? "rgba(239, 68, 68, 1)" : "rgba(239, 68, 68, 0.5)";
    if (status === "dead") return selected ? "rgba(148, 163, 184, 0.6)" : `color-mix(in srgb, ${headerColor} 12%, rgba(148, 163, 184, 0.18))`;
    if (status === "entry") return selected ? "var(--primary)" : "rgba(99, 102, 241, 0.5)";
    if (heatmapEnabled && complexity !== undefined) {
      const hue = Math.max(0, 120 - complexity * 8);
      const sat = Math.min(100, 35 + complexity * 3.5);
      return `hsl(${hue}, ${sat}%, 45%)`;
    }
    return selected ? headerColor : `color-mix(in srgb, ${headerColor} 25%, rgba(255, 255, 255, 0.08))`;
  };

  const borderGlow = () => {
    if (selected) {
      if (status === "god") return "0 0 24px rgba(239, 68, 68, 0.5), inset 0 0 12px rgba(239, 68, 68, 0.2)";
      if (status === "entry") return "0 0 24px rgba(99, 102, 241, 0.5), inset 0 0 12px rgba(99, 102, 241, 0.2)";
      if (status === "dead") return "0 0 16px rgba(148, 163, 184, 0.2)";
      return `0 0 24px color-mix(in srgb, ${headerColor} 40%, transparent), inset 0 0 12px color-mix(in srgb, ${headerColor} 15%, transparent)`;
    }
    return `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 1px color-mix(in srgb, ${headerColor} 20%, transparent)`;
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
          transform: "translateY(-4px)",
          boxShadow: status === "god" ? "0 12px 30px rgba(239, 68, 68, 0.45)" :
                     status === "entry" ? "0 12px 30px rgba(99, 102, 241, 0.45)" :
                     status === "dead" ? "0 8px 24px rgba(148, 163, 184, 0.2)" :
                     `0 12px 30px color-mix(in srgb, ${headerColor} 35%, rgba(0, 0, 0, 0.6))`,
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
          borderBottom: `1px solid color-mix(in srgb, ${headerColor} 12%, rgba(255,255,255,0.04))`,
          bgcolor: status === "dead" ? "rgba(255,255,255,0.01)" : `color-mix(in srgb, ${headerColor} 8%, rgba(255,255,255,0.01))`,
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
            bgcolor: `color-mix(in srgb, ${iconColor ?? headerColor} 12%, rgba(255,255,255,0.04))`,
            color: iconColor ?? headerColor,
            border: `1px solid color-mix(in srgb, ${iconColor ?? headerColor} 20%, transparent)`,
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
