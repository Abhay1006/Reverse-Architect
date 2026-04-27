"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Braces } from "lucide-react";
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
      icon={<Braces width={16} height={16} />}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-accent">function</span>
          {data.metadata?.maxComplexity !== undefined && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${data.metadata.maxComplexity > 10 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
              C:{data.metadata.maxComplexity}
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/30 truncate" title={fullPath}>{formattedPath}</span>
      </div>
    </BaseNode>
  );
};

export default memo(FunctionNode);
