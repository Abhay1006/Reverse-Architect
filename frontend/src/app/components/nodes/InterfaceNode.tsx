"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Box, Typography, Chip } from "@mui/material";
import { Extension as PuzzleIcon } from "@mui/icons-material";
import BaseNode from "./BaseNode";
import { useAtlasStore } from "../../store/atlas-store";
import { InterfaceNode as InterfaceNodeType } from "../../types/nodes";

const InterfaceNode = ({ data, selected, id, sourcePosition, targetPosition }: NodeProps<InterfaceNodeType>) => {
  const analysis = useAtlasStore((state) => state.analysisResults);
  const isDeadCode = analysis?.deadCode.includes(id);

  return (
    <BaseNode
      label={data.label as string}
      selected={selected}
      status={isDeadCode ? "dead" : "default"}
      headerColor="var(--interface-bg)"
      icon={<PuzzleIcon sx={{ fontSize: 16 }} />}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {data.metadata?.properties && (data.metadata.properties as string[]).length > 0 && (
          <Box>
            <Box sx={{ mt: 0.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {(data.metadata.properties as string[]).map((prop, i) => (
                <Typography
                  key={i}
                  sx={{
                    fontSize: "0.75rem",
                    color: "var(--secondary)",
                    fontFamily: "monospace",
                    fontStyle: "italic",
                  }}
                >
                  {prop}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
        
        {data.metadata?.methods && (data.metadata.methods as string[]).length > 0 && (
          <Box sx={{ pt: 1, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <Box sx={{ mt: 0.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {(data.metadata.methods as string[]).map((method, i) => (
                <Typography
                  key={i}
                  sx={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "monospace",
                  }}
                >
                  {method}()
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </BaseNode>
  );
};

export default memo(InterfaceNode);
