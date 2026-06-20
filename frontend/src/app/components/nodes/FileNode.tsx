"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Box, Typography } from "@mui/material";
import { InsertDriveFile as FileTextIcon, Bolt as ZapIcon } from "@mui/icons-material";
import BaseNode from "./BaseNode";
import { FileNode as FileNodeType } from "../../types/nodes";

import { useAtlasStore } from "../../store/atlas-store";

const getLanguageDetails = (filePath: string) => {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case '.py':
    case '.pyw':
      return { label: 'Python', short: 'PY', color: '#3776ab' };
    case '.go':
      return { label: 'Go', short: 'GO', color: '#00add8' };
    case '.rs':
      return { label: 'Rust', short: 'RS', color: '#ce412b' };
    case '.java':
      return { label: 'Java', short: 'JV', color: '#ea2d2e' };
    case '.kt':
    case '.kts':
      return { label: 'Kotlin', short: 'KT', color: '#7f52ff' };
    case '.swift':
      return { label: 'Swift', short: 'SW', color: '#f05138' };
    case '.m':
      return { label: 'Objective-C', short: 'M', color: '#438eff' };
    case '.mm':
      return { label: 'Objective-C++', short: 'MM', color: '#6866fb' };
    case '.h':
      return { label: 'Header', short: 'H', color: '#0ea5e9' };
    case '.pch':
      return { label: 'PCH', short: 'PCH', color: '#0d9488' };
    case '.c':
      return { label: 'C', short: 'C', color: '#64748b' };
    case '.cpp':
    case '.hpp':
    case '.cc':
    case '.cxx':
      return { label: 'C++', short: 'C++', color: '#00599c' };
    case '.cs':
      return { label: 'C#', short: 'C#', color: '#239120' };
    case '.rb':
      return { label: 'Ruby', short: 'RB', color: '#cc342d' };
    case '.php':
      return { label: 'PHP', short: 'PHP', color: '#777bb4' };
    case '.ts':
    case '.tsx':
      return { label: 'TypeScript', short: 'TS', color: '#3178c6' };
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return { label: 'JavaScript', short: 'JS', color: '#f7df1e' };
    case '.sql':
      return { label: 'SQL', short: 'SQL', color: '#00758f' };
    case '.prisma':
      return { label: 'Prisma', short: 'PR', color: '#5a67d8' };
    default:
      return { label: 'Code', short: ext.substring(1).toUpperCase() || 'SRC', color: '#94a3b8' };
  }
};

const DIRECTORY_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#0ea5e9', // Sky Blue
  '#14b8a6', // Teal
  '#10b981', // Emerald Green
  '#84cc16', // Lime Green
  '#eab308', // Yellow
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#d946ef', // Magenta
  '#a855f7', // Purple
];

const getDirectoryColor = (filePath: string, defaultColor: string) => {
  const parts = filePath.split('/');
  if (parts.length <= 1) {
    return defaultColor;
  }
  const parentDir = parts.slice(0, -1).join('/');
  let hash = 0;
  for (let i = 0; i < parentDir.length; i++) {
    hash = parentDir.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DIRECTORY_COLORS.length;
  return DIRECTORY_COLORS[index]!;
};

const FileNode = ({ data, selected, sourcePosition, targetPosition }: NodeProps<FileNodeType>) => {
  const fullPath = data.filePath as string;
  const expandedFiles = useAtlasStore(s => s.expandedFiles);
  const isExpanded = expandedFiles.has(fullPath);

  const isEntryPoint = !!(data as any).analysis?.isEntryPoint;
  const status = isEntryPoint ? "entry" : "default";

  const entities = (data.metadata as any)?.entities || [];
  const maxComplexity = (data.metadata as any)?.maxComplexity;
  const lang = getLanguageDetails(fullPath);
  const dirColor = getDirectoryColor(fullPath, lang.color);

  return (
    <BaseNode
      label={data.label as string}
      selected={selected}
      headerColor={isEntryPoint ? "var(--primary)" : dirColor}
      iconColor={lang.color}
      status={status}
      complexity={maxComplexity}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
      icon={
        isEntryPoint ? (
          <ZapIcon sx={{ fontSize: 16 }} />
        ) : (
          <Box
            component="span"
            sx={{
              fontSize: "0.6rem",
              fontWeight: 900,
              color: lang.short === 'JS' ? '#17171a' : 'white',
              fontFamily: "monospace",
              lineHeight: 1,
            }}
          >
            {lang.short}
          </Box>
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
          {fullPath}
        </Typography>

        {entities.length > 0 && (
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
            {entities.slice(0, 3).map((entity: any, i: number) => (
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
                <Typography sx={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                  {entity.name}
                </Typography>
                <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', ml: 'auto', textTransform: 'uppercase' }}>
                  {entity.type}
                </Typography>
              </Box>
            ))}
            {entities.length > 3 && (
              <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', mt: 0.5 }}>
                + {entities.length - 3} more exports
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
          {(data.metadata as any)?.maxComplexity ? (
             <Box sx={{ 
               bgcolor: (data.metadata as any).maxComplexity > 10 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', 
               color: (data.metadata as any).maxComplexity > 10 ? '#fca5a5' : 'rgba(255,255,255,0.5)',
               px: 1, py: 0.25, borderRadius: 1, fontSize: '0.5625rem', fontWeight: 700 
             }}>
               Complexity: {(data.metadata as any).maxComplexity}
             </Box>
          ) : null}
          {(data.metadata as any)?.lineCount ? (
             <Box sx={{ 
               bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
               px: 1, py: 0.25, borderRadius: 1, fontSize: '0.5625rem', fontWeight: 700 
             }}>
               {(data.metadata as any).lineCount} L
             </Box>
          ) : null}
        </Box>
      </Box>
    </BaseNode>
  );
};

export default memo(FileNode);
