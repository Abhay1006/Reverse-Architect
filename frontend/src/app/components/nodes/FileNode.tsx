"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { FileText, Zap } from "lucide-react";
import BaseNode from "./BaseNode";
import { FileNode as FileNodeType } from "../../types/nodes";

const FileNode = ({ data, selected }: NodeProps<FileNodeType>) => {
  const fullPath = data.filePath as string;
  const pathParts = fullPath.split('/');
  // Display at most the last 3 segments (e.g. dir/subdir/file.ts)
  const formattedPath = pathParts.slice(Math.max(0, pathParts.length - 3)).join('/');

  const isEntryPoint = !!(data as any).analysis?.isEntryPoint;
  const status = isEntryPoint ? "entry" : "default";

  return (
    <BaseNode
      label={data.label as string}
      selected={selected}
      headerColor={isEntryPoint ? "var(--primary)" : "var(--file-bg)"}
      status={status}
      icon={
        isEntryPoint ? (
          <Zap width={16} height={16} fill="currentColor" />
        ) : (
          <FileText width={16} height={16} />
        )
      }
    >
      <div className="text-[10px] text-white/40 truncate" title={fullPath}>
        {formattedPath}
      </div>
    </BaseNode>
  );
};

export default memo(FileNode);
