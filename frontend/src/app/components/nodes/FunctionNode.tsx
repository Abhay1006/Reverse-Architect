"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import { useAtlasStore } from "../../store/atlas-store";
import { FunctionNode as FunctionNodeType } from "../../types/nodes";

const FunctionNode = ({ data, selected, id }: NodeProps<FunctionNodeType>) => {
  const analysis = useAtlasStore((state) => state.analysisResults);
  const isDeadCode = analysis?.deadCode.includes(id);

  const fullPath = data.filePath as string;
  const pathParts = fullPath.split('/');
  const formattedPath = pathParts.slice(Math.max(0, pathParts.length - 3)).join('/');

  return (
    <BaseNode
      label={data.label as string}
      selected={selected}
      status={isDeadCode ? "dead" : "default"}
      headerColor="var(--function-bg)"
      className="min-w-[180px]"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 21-4.3-4.3"/><circle cx="10" cy="10" r="7"/><path d="M10 13V7"/><path d="M7 10h6"/></svg>
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-accent">function</span>
        <span className="text-[10px] text-white/30 truncate" title={fullPath}>{formattedPath}</span>
      </div>
    </BaseNode>
  );
};

export default memo(FunctionNode);
