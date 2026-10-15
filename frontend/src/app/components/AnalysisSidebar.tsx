"use client";

import React from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  List,
  ListItemButton,
} from "@mui/material";
import {
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  Class as ClassIcon,
  Extension as InterfaceIcon,
  Functions as FunctionsIcon,
  Warning as WarningIcon,
  VisibilityOff as DeadCodeIcon,
  Autorenew as CycleIcon,
  Layers as PatternsIcon,
} from "@mui/icons-material";
import { useAtlasStore } from "../store/atlas-store";
import { StatCard, IssueAccordion, EdgeStat } from "./analysis/SidebarParts";
import SelectedNodeDetails from "./analysis/SelectedNodeDetails";
import { useAnalysisSummary } from "./analysis/useAnalysisSummary";

interface AnalysisSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AnalysisSidebar({
  isOpen,
  onClose,
}: AnalysisSidebarProps) {
  const panToNode = useAtlasStore((s) => s.panToNode);
  const {
    analysis,
    stats,
    topFiles,
    nodeLabel,
    godObjectItems,
    deadCodeItems,
    edgeCounts,
    godObjectCount,
    deadCodeCount,
    cycleCount,
    patternCount,
    totalIssues,
  } = useAnalysisSummary();

  return (
    <Drawer
      variant="temporary"
      anchor="right"
      open={isOpen}
      onClose={onClose}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 2,
        "& .MuiDrawer-paper": {
          width: 360,
          boxSizing: "border-box",
          background: "var(--glass-bg)",
          backdropFilter: "blur(40px)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.7)",
          height: "100%",
          overflowX: "hidden",
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: "blur(2px)",
            background: "rgba(0,0,0,0.3)",
          },
        },
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          pt: 3,
          pb: 2,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 15,
              fontWeight: 700,
              color: "rgba(255,255,255,0.92)",
              letterSpacing: "-0.01em",
            }}
          >
            Analysis
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 0.25 }}>
            Architecture overview
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ── Selected Node Details ───────────────────────── */}
      <SelectedNodeDetails />

      {/* ── Project Summary ────────────────────────────── */}
      <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Project Summary
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <StatCard
            icon={<FileIcon sx={{ fontSize: 16 }} />}
            label="Files"
            value={stats.files}
            color="var(--file-bg)"
          />
          <StatCard
            icon={<ClassIcon sx={{ fontSize: 16 }} />}
            label="Classes"
            value={stats.classes}
            color="var(--class-bg)"
          />
          <StatCard
            icon={<InterfaceIcon sx={{ fontSize: 16 }} />}
            label="Interfaces"
            value={stats.interfaces}
            color="var(--interface-bg)"
          />
          <StatCard
            icon={<FunctionsIcon sx={{ fontSize: 16 }} />}
            label="Functions"
            value={stats.functions}
            color="var(--function-bg)"
          />
        </Box>

        {/* Totals bar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mt: 1.25,
            p: "10px 0",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 2.5,
          }}
        >
          {[
            { value: stats.total, label: "Nodes" },
            { value: stats.edges, label: "Edges" },
            { value: patternCount, label: "Patterns" },
          ].map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && (
                <Box
                  sx={{
                    width: 1,
                    height: 24,
                    background: "rgba(255,255,255,0.06)",
                  }}
                />
              )}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1,
                  }}
                >
                  {item.value}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.5625rem",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.25)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    mt: 0.375,
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            </React.Fragment>
          ))}
        </Box>
      </Box>

      {/* ── Intelligence Layer: Most Critical Files ──────────────────────── */}
      {topFiles.length > 0 && (
        <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(99,102,241,0.03)" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ color: "#818cf8" }}>Most Critical Files</Typography>
            <Chip
              label="Start Here"
              size="small"
              sx={{ height: 20, fontSize: "0.625rem", fontWeight: 700, bgcolor: "rgba(99,102,241,0.2)", color: "#818cf8" }}
            />
          </Box>
          <List dense disablePadding>
            {topFiles.map((file, idx) => (
              <ListItemButton
                key={file.id}
                onClick={() => panToNode(file.id)}
                sx={{
                  borderRadius: 1.5,
                  py: 1,
                  px: 1.5,
                  mb: 0.5,
                  bgcolor: idx === 0 ? "rgba(99,102,241,0.1)" : "transparent",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", gap: 1 }}>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: idx === 0 ? "#818cf8" : "rgba(255,255,255,0.8)" }}>
                    {idx + 1}.
                  </Typography>
                  <Box sx={{ flex: 1, overflow: "hidden" }}>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                      {file.label}
                    </Typography>
                    <Typography sx={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", mb: 0.5 }}>
                      {file.path}
                    </Typography>
                    <Typography sx={{ fontSize: "0.625rem", color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {file.score > 15 ? "🔥 Architectural Hub" : file.score > 10 ? "⚡ Core Logic" : "📦 Module Container"}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <Chip
                      label={`Score: ${file.score}`}
                      size="small"
                      sx={{ height: 18, fontSize: "0.5625rem", fontWeight: 700, bgcolor: "rgba(0,0,0,0.3)", color: "rgba(255,255,255,0.5)", mb: 0.5 }}
                    />
                  </Box>
                </Box>
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}

      {/* ── Issues ─────────────────────────────────────── */}
      <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1.5,
          }}
        >
          <Typography variant="subtitle2">Issues</Typography>
          {totalIssues > 0 ? (
            <Chip
              label={`${totalIssues} found`}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.625rem",
                fontWeight: 600,
                color: "var(--god-object)",
                bgcolor: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            />
          ) : (
            <Chip
              label="✓ Clean"
              size="small"
              sx={{
                height: 20,
                fontSize: "0.625rem",
                fontWeight: 600,
                color: "#22c55e",
                bgcolor: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.15)",
              }}
            />
          )}
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <IssueAccordion
            icon={<WarningIcon sx={{ fontSize: 14 }} />}
            label="God Objects"
            count={godObjectCount}
            color="var(--god-object)"
            items={godObjectItems}
            onItemClick={panToNode}
          />
          <IssueAccordion
            icon={<DeadCodeIcon sx={{ fontSize: 14 }} />}
            label="Dead Code"
            count={deadCodeCount}
            color="var(--dead-code)"
            items={deadCodeItems}
            onItemClick={panToNode}
          />
          <IssueAccordion
            icon={<CycleIcon sx={{ fontSize: 14 }} />}
            label="Circular Deps"
            count={cycleCount}
            color="#f59e0b"
            items={(analysis?.cycles ?? []).map((cycle, i) => ({
              id: cycle[0],
              label: `Cycle ${i + 1}`,
              sublabel: cycle.map(nodeLabel).join(" → "),
            }))}
            onItemClick={panToNode}
          />
          <IssueAccordion
            icon={<PatternsIcon sx={{ fontSize: 14 }} />}
            label="Patterns"
            count={patternCount}
            color="#8b5cf6"
            items={(analysis?.patterns ?? []).map((p) => ({
              id: p.nodeId,
              label: nodeLabel(p.nodeId),
              // Show why it matched, not just that it did.
              sublabel: `[${p.pattern.toUpperCase()}] ${p.confidence} · ${(p.reasons ?? []).slice(0, 2).join("; ")}`,
            }))}
            onItemClick={panToNode}
          />
        </Box>
      </Box>

      {/* ── Edge Breakdown ─────────────────────────────── */}
      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Connections
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          <EdgeStat label="Imports" count={edgeCounts.import} color="var(--primary)" />
          <EdgeStat label="Calls" count={edgeCounts.calls} color="#f59e0b" />
          <EdgeStat label="Extends" count={edgeCounts.extends} color="var(--secondary)" />
          <EdgeStat label="Implements" count={edgeCounts.implements} color="var(--accent)" />
        </Box>
      </Box>
    </Drawer>
  );
}
