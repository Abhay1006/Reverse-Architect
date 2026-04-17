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
  status?: "god" | "dead" | "default";
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
  return (
    <div
      className={`
        relative min-w-[240px] rounded-xl border border-white/10 bg-[#17171a]/90 
        backdrop-blur-xl shadow-2xl transition-all duration-300
        ${selected ? "ring-2 ring-primary border-primary/50" : ""}
        ${status === "god" ? "god-object-pulse" : ""}
        ${status === "dead" ? "opacity-40 grayscale-[50%]" : ""}
        ${className}
      `}
      style={{
        boxShadow: selected ? "0 0 20px var(--primary-glow)" : "0 10px 30px rgba(0,0,0,0.5)",
      }}
    >
      {/* Node Header */}
      <div 
        className="flex items-center gap-3 px-4 py-3 rounded-t-xl border-b border-white/5"
        style={{ background: `linear-gradient(135deg, ${headerColor}22, ${headerColor}0a)` }}
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
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-[#17171a]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-[#17171a]"
      />
    </div>
  );
};

export default memo(BaseNode);
