"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Box, Typography } from "@mui/material";
import { InsertDriveFile as FileTextIcon, Bolt as ZapIcon } from "@mui/icons-material";
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
          <ZapIcon sx={{ fontSize: 16 }} />
        ) : (
          <FileTextIcon sx={{ fontSize: 16 }} />
        )
      }
    >
      <Typography
        sx={{
          fontSize: "0.625rem",
          color: "rgba(255,255,255,0.4)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={fullPath}
      >
        {formattedPath}
      </Typography>
    </BaseNode>
  );
};

export default memo(FileNode);
