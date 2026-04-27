"use client";

import React, { memo, ReactNode } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

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
    <div
      className={`
        relative min-w-[240px] rounded-2xl border backdrop-blur-3xl shadow-2xl transition-all duration-300
        ${status === "god" ? "god-object-pulse border-red-500/80" : ""}
        ${status === "dead" ? "opacity-60 border-dashed border-slate-500/50" : ""}
        ${status === "entry" ? "shadow-[0_0_30px_rgba(99,102,241,0.3)]" : ""}
        ${className}
      `}
      style={{
        background: getBackgroundStyle(),
        borderColor: getBorderColor(),
        boxShadow: selected ? `0 0 25px color-mix(in srgb, ${headerColor} 40%, transparent)` : "0 10px 40px rgba(0,0,0,0.6)",
        transform: selected ? "translateY(-2px)" : "none",
      }}
    >
      {/* Node Header */}
      <div 
        className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ 
           background: `color-mix(in srgb, ${status === 'god' ? '#ef4444' : headerColor} 15%, transparent)`,
           borderTopLeftRadius: '1rem',
           borderTopRightRadius: '1rem'
        }}
      >
        <div 
          className="p-1.5 rounded-lg text-white"
          style={{ backgroundColor: headerColor }}
        >
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-white/90 truncate">{label}</h3>
      </div>

      {/* Node Content */}
      <div className="px-4 py-3 min-h-[40px]">
        {children}
      </div>

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
    </div>
  );
};

export default memo(BaseNode);
