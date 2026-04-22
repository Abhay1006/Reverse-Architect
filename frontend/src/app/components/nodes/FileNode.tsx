"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import { FileNode as FileNodeType } from "../../types/nodes";

const FileNode = ({ data, selected }: NodeProps<FileNodeType>) => {
  const fullPath = data.filePath as string;
  const pathParts = fullPath.split('/');
  // Display at most the last 3 segments (e.g. dir/subdir/file.ts)
  const formattedPath = pathParts.slice(Math.max(0, pathParts.length - 3)).join('/');

  return (
    <BaseNode
      label={data.label as string}
      selected={selected}
      headerColor="var(--file-bg)"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M9 11h6"/></svg>
      }
    >
      <div className="text-[10px] text-white/40 truncate" title={fullPath}>
        {formattedPath}
      </div>
    </BaseNode>
  );
};

export default memo(FileNode);
