"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Box, Typography } from "@mui/material";
import { InsertDriveFile as FileTextIcon, Bolt as ZapIcon } from "@mui/icons-material";
import BaseNode from "./BaseNode";
import { FileNode as FileNodeType } from "../../types/nodes";

import { useAtlasStore } from "../../store/atlas-store";

const FileNode = ({ data, selected }: NodeProps<FileNodeType>) => {
  const fullPath = data.filePath as string;
  const pathParts = fullPath.split('/');
  const expandedFiles = useAtlasStore(s => s.expandedFiles);
  const isExpanded = expandedFiles.has(fullPath);

  const isEntryPoint = !!(data as any).analysis?.isEntryPoint;
  const status = isEntryPoint ? "entry" : "default";

  const entities = (data.metadata as any)?.entities || [];

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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
          {pathParts[pathParts.length - 1]}
        </Typography>

        {isExpanded && entities.length > 0 && (
          <Box 
            sx={{ 
              mt: 1.5, 
              pt: 1.5, 
              borderTop: "1px solid rgba(255,255,255,0.1)",
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75
            }}
          >
            {entities.map((entity: any, i: number) => (
              <Box 
                key={`${entity.name}-${i}`}
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 1,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.05)" }
                }}
              >
                <Box 
                  sx={{ 
                    width: 4, 
                    height: 4, 
                    borderRadius: '50%', 
                    bgcolor: entity.type === 'class' ? 'var(--class-bg)' : 
                             entity.type === 'function' ? 'var(--function-bg)' : 'var(--interface-bg)'
                  }} 
                />
                <Typography sx={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                  {entity.name}
                </Typography>
                <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', ml: 'auto', textTransform: 'uppercase' }}>
                  {entity.type}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </BaseNode>
  );
};

export default memo(FileNode);
