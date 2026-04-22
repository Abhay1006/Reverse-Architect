"use client";

import React, { memo } from "react";
import { NodeProps, NodeResizer, Node } from "@xyflow/react";

export type GroupNodeData = {
  label: string;
};

export type GroupNodeType = Node<GroupNodeData, "group">;

const GroupNode = ({ data, selected }: NodeProps<GroupNodeType>) => {
  return (
    <>
      <div
        className={`w-full h-full rounded-2xl border-2 transition-all duration-300 pointer-events-none flex flex-col overflow-hidden
          ${selected ? "border-indigo-500 border-solid bg-indigo-500/5 shadow-[inset_0_0_50px_rgba(79,70,229,0.1)]" : "border-white/20 border-dashed bg-white/[0.01]"}
        `}
      >
        {/* Full-width header */}
        <div className={`w-full px-6 py-3 border-b backdrop-blur-xl flex items-center justify-between
          ${selected ? "bg-indigo-500/20 border-indigo-500/50" : "bg-white/10 border-white/10"}
        `}>
          <div className="flex items-center gap-3">
            <span className="opacity-80 text-lg">📁</span>
            <span className="font-mono text-sm tracking-widest uppercase text-white/70 font-bold">
              {data.label}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-white/30 font-bold px-2 py-1 bg-black/40 rounded-md">Directory Module</span>
        </div>
      </div>
    </>
  );
};

export default memo(GroupNode);
