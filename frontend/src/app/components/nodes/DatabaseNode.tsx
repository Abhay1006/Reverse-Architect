"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import { useAtlasStore } from "../../store/atlas-store";
import { DatabaseNodeType } from "../../types/nodes";

const DatabaseNode = ({ data, selected, id }: NodeProps<DatabaseNodeType>) => {
  const analysis = useAtlasStore((state) => state.analysisResults);
  const isGodObject = analysis?.godObjects.includes(id);
  const isDeadCode = analysis?.deadCode.includes(id);
  
  const status = isGodObject ? "god" : isDeadCode ? "dead" : "default";

  return (
    <BaseNode
      label={data.label as string}
      selected={selected}
      status={status}
      headerColor="#10b981" // Emerald green
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
      }
    >
      <div className="space-y-4">
        {/* Placeholder for future schema table columns rendering */}
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="px-2 py-1 rounded bg-white/5 text-[10px] text-[#10b981] font-bold uppercase tracking-wider">
            Table Model
          </span>
        </div>
      </div>
    </BaseNode>
  );
};

export default memo(DatabaseNode);
