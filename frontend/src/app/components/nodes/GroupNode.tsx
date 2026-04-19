"use client";

import React, { memo } from "react";
import { NodeProps, NodeResizer } from "@xyflow/react";

export type GroupNodeData = {
  label: string;
};

const GroupNode = ({ data, selected }: NodeProps<{ label: string }>) => {
  return (
    <>
      <div
        className={`w-full h-full rounded-3xl border-2 transition-all duration-300 pointer-events-none relative
          ${selected ? "border-indigo-500/80 bg-indigo-500/5 shadow-[inset_0_0_50px_rgba(79,70,229,0.1)]" : "border-white/10 bg-white/[0.02]"}
        `}
      >
        <div className="absolute top-0 left-0 bg-[#0a0a0c]/80 backdrop-blur-xl px-6 py-2 rounded-br-2xl border-b border-r border-white/10 font-mono text-sm tracking-widest uppercase text-white/50 font-bold shadow-2xl">
          <span className="mr-3 opacity-60">📁</span>
          {data.label}
        </div>
      </div>
    </>
  );
};

export default memo(GroupNode);
