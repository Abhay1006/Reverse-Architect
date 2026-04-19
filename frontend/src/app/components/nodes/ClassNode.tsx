"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import { useAtlasStore } from "../../store/atlas-store";
import { ClassNode as ClassNodeType } from "../../types/nodes";

const ClassNode = ({ data, selected, id }: NodeProps<ClassNodeType>) => {
  const analysis = useAtlasStore((state) => state.analysisResults);
  
  const isGodObject = analysis?.godObjects.includes(id);
  const isDeadCode = analysis?.deadCode.includes(id);
  const nodePatterns = analysis?.patterns?.filter(p => p.nodeId === id) || [];
  
  const status = isGodObject ? "god" : isDeadCode ? "dead" : "default";

  return (
    <BaseNode
      label={data.label as string}
      selected={selected}
      status={status}
      headerColor="var(--class-bg)"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Z"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M9 15h6"/></svg>
      }
    >
      <div className="space-y-4">
        {/* Properties Section */}
        {data.metadata?.properties && (data.metadata.properties as string[]).length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Properties</span>
            <div className="mt-1 space-y-1">
              {(data.metadata.properties as string[]).map((prop, i) => (
                <div key={i} className="text-xs text-white/70 font-mono py-0.5 border-l border-white/10 pl-2">
                  {prop}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Methods Section */}
        {data.metadata?.methods && (data.metadata.methods as string[]).length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Methods</span>
            <div className="mt-1 space-y-1">
              {(data.metadata.methods as string[]).map((method, i) => (
                <div key={i} className="text-xs text-white/70 font-mono py-0.5 border-l border-white/10 pl-2">
                  {method}()
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info badges */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/40">
            {data.metadata?.lineCount || 0} lines
          </span>
          {isGodObject && (
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-[10px] text-red-400 font-bold">
              GOD OBJECT
            </span>
          )}
          {nodePatterns.map((match, i) => {
            let colorClass = "bg-blue-500/20 text-blue-400";
            if (match.pattern === "factory") colorClass = "bg-purple-500/20 text-purple-400";
            if (match.pattern === "singleton") colorClass = "bg-teal-500/20 text-teal-400";
            return (
              <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${colorClass}`}>
                {match.pattern} ({match.confidence})
              </span>
            );
          })}
        </div>
      </div>
    </BaseNode>
  );
};

export default memo(ClassNode);
