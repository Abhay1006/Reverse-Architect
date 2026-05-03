"use client";

import React, { memo, ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, Typography, Chip } from "@mui/material";

interface BaseNodeProps {
  label: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  headerColor?: string;
  selected?: boolean;
  status?: "god" | "dead" | "entry" | "default";
}

const BaseNode = ({
  label,
  icon,
  children,
  className = "",
  headerColor = "var(--primary)",
  selected = false,
  status = "default",
}: BaseNodeProps) => {

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
    return `linear-gradient(145deg, color-mix(in srgb, ${headerColor} 25%, transparent) 0%, rgba(15, 15, 20, 0.98) 120%)`;
  };

  const getBorderColor = () => {
    if (status === "god") return "rgba(239, 68, 68, 0.8)";
    if (status === "dead") return "rgba(148, 163, 184, 0.3)";
    if (status === "entry") return "var(--primary)";
    return selected ? headerColor : "rgba(255, 255, 255, 0.1)";
  };

  return (
    <Box
      className={className}
      sx={{
        position: "relative",
        minWidth: 240,
        borderRadius: 4,
        border: "1px solid",
        backdropFilter: "blur(30px)",
        boxShadow: selected
          ? `0 0 25px color-mix(in srgb, ${headerColor} 40%, transparent)`
          : "0 10px 40px rgba(0,0,0,0.6)",
        transition: "all 0.3s",
        transform: selected ? "translateY(-2px)" : "none",
        background: getBackgroundStyle(),
        borderColor: getBorderColor(),
        ...(status === "god" && {
          animation: "pulse-red 2s infinite",
          borderWidth: 2,
          borderColor: "var(--god-object)",
        }),
        ...(status === "dead" && {
          opacity: 0.6,
          borderStyle: "dashed",
          borderColor: "rgba(148,163,184,0.5)",
        }),
        ...(status === "entry" && {
          boxShadow: "0 0 30px rgba(99,102,241,0.3)",
        }),
      }}
    >
      {/* Node Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: `color-mix(in srgb, ${status === 'god' ? '#ef4444' : headerColor} 15%, transparent)`,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        <Box
          sx={{
            p: 0.75,
            borderRadius: 2,
            color: "white",
            bgcolor: headerColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-[#17171a]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-[#17171a]"
      />
    </Box>
  );
};

export default memo(BaseNode);
