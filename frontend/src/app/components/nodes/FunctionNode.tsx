"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Box, Typography, Chip } from "@mui/material";
import { Functions as BracesIcon } from "@mui/icons-material";
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
      icon={<BracesIcon sx={{ fontSize: 16 }} />}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            sx={{
              fontSize: "0.75rem",
              fontFamily: "monospace",
              color: "var(--accent)",
            }}
          >
            function
          </Typography>
          {data.metadata?.maxComplexity !== undefined && (
            <Chip
              label={`C:${data.metadata.maxComplexity}`}
              size="small"
              sx={{
                height: 18,
                fontSize: "0.625rem",
                fontWeight: 700,
                borderRadius: "9px",
                bgcolor: (data.metadata.maxComplexity as number) > 10
                  ? "rgba(239,68,68,0.2)"
                  : "rgba(34,197,94,0.1)",
                color: (data.metadata.maxComplexity as number) > 10
                  ? "#f87171"
                  : "#4ade80",
              }}
            />
          )}
        </Box>
        <Typography
          sx={{
            fontSize: "0.625rem",
            color: "rgba(255,255,255,0.3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={fullPath}
        >
          {formattedPath}
        </Typography>
      </Box>
    </BaseNode>
  );
};

export default memo(FunctionNode);
