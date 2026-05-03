"use client";

import React, { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Box, Typography, Chip } from "@mui/material";
import { Class as BookOpenIcon } from "@mui/icons-material";
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
      icon={<BookOpenIcon sx={{ fontSize: 16 }} />}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Properties Section */}
        {data.metadata?.properties && (data.metadata.properties as string[]).length > 0 && (
          <Box>
            <Typography
              sx={{
                fontSize: "0.625rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.4)",
                fontWeight: 700,
              }}
            >
              Properties
            </Typography>
            <Box sx={{ mt: 0.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {(data.metadata.properties as string[]).map((prop, i) => (
                <Typography
                  key={i}
                  sx={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: "monospace",
                    py: 0.25,
                    borderLeft: "2px solid rgba(255,255,255,0.1)",
                    pl: 1,
                  }}
                >
                  {prop}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Methods Section */}
        {data.metadata?.methods && (data.metadata.methods as string[]).length > 0 && (
          <Box>
            <Typography
              sx={{
                fontSize: "0.625rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.4)",
                fontWeight: 700,
              }}
            >
              Methods
            </Typography>
            <Box sx={{ mt: 0.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {(data.metadata.methods as string[]).map((method, i) => (
                <Typography
                  key={i}
                  sx={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: "monospace",
                    py: 0.25,
                    borderLeft: "2px solid rgba(255,255,255,0.1)",
                    pl: 1,
                  }}
                >
                  {method}()
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Info badges */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.75,
            pt: 1,
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <Chip
            label={`${data.metadata?.lineCount || 0} lines`}
            size="small"
            sx={{
              height: 20,
              fontSize: "0.625rem",
              bgcolor: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.4)",
            }}
          />
          {data.metadata?.maxComplexity !== undefined && (
            <Chip
              label={`C:${data.metadata.maxComplexity}`}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.625rem",
                fontWeight: 700,
                bgcolor: (data.metadata.maxComplexity as number) > 15
                  ? "rgba(239,68,68,0.2)"
                  : "rgba(34,197,94,0.1)",
                color: (data.metadata.maxComplexity as number) > 15
                  ? "#f87171"
                  : "#4ade80",
              }}
            />
          )}
          {isGodObject && (
            <Chip
              label="GOD OBJECT"
              size="small"
              color="error"
              sx={{
                height: 20,
                fontSize: "0.625rem",
                fontWeight: 700,
              }}
            />
          )}
          {nodePatterns.map((match, i) => {
            const chipColor =
              match.pattern === "factory"
                ? { bgcolor: "rgba(168,85,247,0.2)", color: "#c084fc" }
                : match.pattern === "singleton"
                  ? { bgcolor: "rgba(20,184,166,0.2)", color: "#2dd4bf" }
                  : { bgcolor: "rgba(59,130,246,0.2)", color: "#60a5fa" };

            return (
              <Chip
                key={i}
                label={`${match.pattern} (${match.confidence})`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  ...chipColor,
                }}
              />
            );
          })}
        </Box>
      </Box>
    </BaseNode>
  );
};

export default memo(ClassNode);
