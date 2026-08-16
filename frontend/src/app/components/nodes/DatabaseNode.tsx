"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Box, Chip } from "@mui/material";
import { Storage as DatabaseIcon } from "@mui/icons-material";
import BaseNode from "./BaseNode";
import { useAtlasStore } from "../../store/atlas-store";
import { DatabaseNodeType } from "../../types/nodes";

const DatabaseNode = ({ data, selected, id, sourcePosition, targetPosition }: NodeProps<DatabaseNodeType>) => {
  const analysis = useAtlasStore((state) => state.analysisResults);
  const isGodObject = analysis?.godObjects.includes(id);
  const isDeadCode = analysis?.deadCode.includes(id);
  
  const status = isGodObject ? "god" : isDeadCode ? "dead" : "default";

  return (
    <BaseNode
      label={data.label as string}
      selected={selected}
      status={status}
      headerColor="#10b981" // Emerald green
      icon={<DatabaseIcon sx={{ fontSize: 16 }} />}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Placeholder for future schema table columns rendering */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, pt: 1 }}>
          <Chip
            label="Table Model"
            size="small"
            sx={{
              height: 20,
              fontSize: "0.625rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              bgcolor: "rgba(255,255,255,0.05)",
              color: "#10b981",
            }}
          />
        </Box>
      </Box>
    </BaseNode>
  );
};

export default memo(DatabaseNode);
