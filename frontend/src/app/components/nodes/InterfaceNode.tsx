"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Puzzle } from "lucide-react";
import BaseNode from "./BaseNode";
import { useAtlasStore } from "../../store/atlas-store";
import { InterfaceNode as InterfaceNodeType } from "../../types/nodes";

const InterfaceNode = ({ data, selected, id }: NodeProps<InterfaceNodeType>) => {
  const analysis = useAtlasStore((state) => state.analysisResults);
  const isDeadCode = analysis?.deadCode.includes(id);

  return (
    <BaseNode
      label={data.label as string}
      selected={selected}
      status={isDeadCode ? "dead" : "default"}
      headerColor="var(--interface-bg)"
      icon={<Puzzle width={16} height={16} />}
    >
      <div className="space-y-3">
        {data.metadata?.properties && (data.metadata.properties as string[]).length > 0 && (
          <div>
            <div className="mt-1 space-y-1">
              {(data.metadata.properties as string[]).map((prop, i) => (
                <div key={i} className="text-xs text-secondary font-mono italic">
                  {prop}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {data.metadata?.methods && (data.metadata.methods as string[]).length > 0 && (
          <div className="pt-2 border-t border-white/5">
            <div className="mt-1 space-y-1">
              {(data.metadata.methods as string[]).map((method, i) => (
                <div key={i} className="text-xs text-white/60 font-mono">
                  {method}()
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default memo(InterfaceNode);
