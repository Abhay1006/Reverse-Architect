"use client";

import React, { useMemo } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItemButton,
  ListItemText,
  Badge,
  Divider,
} from "@mui/material";
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  InsertDriveFile as FileIcon,
  Class as ClassIcon,
  Extension as InterfaceIcon,
  Functions as FunctionsIcon,
  Warning as WarningIcon,
  VisibilityOff as DeadCodeIcon,
  Autorenew as CycleIcon,
  Layers as PatternsIcon,
  FilterCenterFocus as FocusIcon,
} from "@mui/icons-material";
import { useAtlasStore } from "../store/atlas-store";

interface AnalysisSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ── Stat Card ─────────────────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        p: "10px 12px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 2.5,
        transition: "all 0.2s",
        "&:hover": {
          background: "rgba(255,255,255,0.05)",
          borderColor: "rgba(255,255,255,0.08)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 2,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          color: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 700,
            color: "rgba(255,255,255,0.9)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.625rem",
            fontWeight: 500,
            color: "rgba(255,255,255,0.35)",
            mt: 0.25,
          }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

/* ── Issue Accordion ──────────────────────────────────────────────────── */

function IssueAccordion({
  icon,
  label,
  count,
  color,
  items,
  onItemClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  items: { id: string; label: string; sublabel?: string }[];
  onItemClick?: (id: string) => void;
}) {
  return (
    <Accordion disabled={count === 0} disableGutters>
      <AccordionSummary expandIcon={count > 0 ? <ExpandMoreIcon sx={{ fontSize: 18, color: "text.secondary" }} /> : undefined}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
          <Box sx={{ color, display: "flex", alignItems: "center" }}>{icon}</Box>
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>
            {label}
          </Typography>
          <Box sx={{ ml: "auto", mr: 1 }}>
            <Chip
              label={count}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.625rem",
                fontWeight: 700,
                bgcolor: count > 0 ? color : "rgba(255,255,255,0.05)",
                color: count > 0 ? "#fff" : "rgba(255,255,255,0.3)",
                minWidth: 28,
              }}
            />
          </Box>
        </Box>
      </AccordionSummary>
      {items.length > 0 && (
        <AccordionDetails sx={{ pt: 0, px: 1, pb: 1 }}>
          <List dense disablePadding>
            {items.map((item, idx) => (
              <ListItemButton
                key={`${item.id}-${idx}`}
                onClick={() => onItemClick?.(item.id)}
                sx={{
                  borderRadius: 1.5,
                  py: 0.75,
                  px: 1.5,
                  "&:hover": { background: "rgba(255,255,255,0.05)" },
                }}
              >
                <ListItemText
                  primary={
                    <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.8)" }}>
                      {item.label}
                    </Typography>
                  }
                  secondary={
                    item.sublabel ? (
                      <Typography sx={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.3)" }}>
                        {item.sublabel}
                      </Typography>
                    ) : undefined
                  }
                />
                <Typography
                  sx={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    opacity: 0,
                    transition: "opacity 0.15s",
                    ".MuiListItemButton-root:hover &": { opacity: 1 },
                  }}
                >
                  View
                </Typography>
              </ListItemButton>
            ))}
          </List>
        </AccordionDetails>
      )}
    </Accordion>
  );
}

/* ── Edge Stat ────────────────────────────────────────────────────────── */

function EdgeStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        p: "6px 10px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
          }}
        />
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.6)" }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
        {count}
      </Typography>
    </Box>
  );
}

/* ── Main Sidebar ─────────────────────────────────────────────────────── */

export default function AnalysisSidebar({
  isOpen,
  onClose,
}: AnalysisSidebarProps) {
  const nodes = useAtlasStore((s) => s.nodes);
  const edges = useAtlasStore((s) => s.edges);
  const analysis = useAtlasStore((s) => s.analysisResults);
  const godObjectDetails = useAtlasStore((s) => s.godObjectDetails);
  const deadCodeDetails = useAtlasStore((s) => s.deadCodeDetails);
  const panToNode = useAtlasStore((s) => s.panToNode);
  const selectedNodeId = useAtlasStore((s) => s.selectedNodeId);
  const setFocusedNode = useAtlasStore((s) => s.setFocusedNode);

  const selectedNode = useMemo(() => 
    nodes.find(n => n.id === selectedNodeId), 
  [nodes, selectedNodeId]);

  // Neighbor counts for selected node
  const neighborCounts = useMemo(() => {
    if (!selectedNodeId) return { in: 0, out: 0 };
    let incoming = 0;
    let outgoing = 0;
    edges.forEach(e => {
      if (e.source === selectedNodeId) outgoing++;
      if (e.target === selectedNodeId) incoming++;
    });
    return { in: incoming, out: outgoing };
  }, [edges, selectedNodeId]);

  const stats = useMemo(() => {
    const files = nodes.filter((n) => n.type === "file").length;
    const classes = nodes.filter((n) => n.type === "class").length;
    const interfaces = nodes.filter((n) => n.type === "interface").length;
    const functions = nodes.filter((n) => n.type === "function").length;
    return {
      files,
      classes,
      interfaces,
      functions,
      total: nodes.length,
      edges: edges.length,
    };
  }, [nodes, edges]);

  const topFiles = useMemo(() => {
    return nodes
      .filter((n) => n.type === "file")
      .map((n) => ({
        id: n.id,
        label: n.data.label as string,
        score: (n.data.metadata as any)?.importanceScore || 0,
        path: n.data.filePath as string,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [nodes]);

  // Resolve node IDs to labels for display
  const nodeLabel = (id: string) => {
    const n = nodes.find((node) => node.id === id);
    return (n?.data as any)?.label ?? id;
  };

  // Build god object display items with connection counts
  const godObjectItems = useMemo(() => {
    if (godObjectDetails && godObjectDetails.length > 0) {
      return godObjectDetails.map((d) => ({
        id: d.nodeId,
        label: d.label,
        sublabel: `${d.totalDegree} connections (${d.inDegree} in, ${d.outDegree} out)`,
      }));
    }
    return (analysis?.godObjects ?? []).map((id) => ({
      id,
      label: nodeLabel(id),
    }));
  }, [godObjectDetails, analysis, nodes]);

  const deadCodeItems = useMemo(() => {
    if (deadCodeDetails && deadCodeDetails.length > 0) {
      return deadCodeDetails.map((d) => ({
        id: d.nodeId,
        label: d.label,
        sublabel: `[${d.nodeType}] ${d.filePath}`,
      }));
    }
    return (analysis?.deadCode ?? []).map((id) => ({
      id,
      label: nodeLabel(id),
    }));
  }, [deadCodeDetails, analysis, nodes]);

  const godObjectCount = godObjectItems.length;
  const deadCodeCount = deadCodeItems.length;
  const cycleCount = analysis?.cycles?.length ?? 0;
  const patternCount = analysis?.patterns?.length ?? 0;
  const totalIssues =
    godObjectCount + deadCodeCount + cycleCount + patternCount;

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
      {selectedNode && (
        <Box sx={{ px: 2.5, py: 2.5, bgcolor: "rgba(99, 102, 241, 0.08)", borderBottom: "1px solid rgba(99, 102, 241, 0.2)" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: "var(--primary)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {selectedNode.type} Details
              </Typography>
              <Typography sx={{ fontSize: "1.125rem", color: "white", fontWeight: 800, lineHeight: 1.2 }}>
                {selectedNode.data?.label}
              </Typography>
            </Box>
            <IconButton 
              size="small" 
              onClick={() => setFocusedNode(selectedNode.id)}
              sx={{ 
                bgcolor: "var(--primary)", 
                color: "white", 
                "&:hover": { bgcolor: "var(--secondary)", transform: "scale(1.1)" },
                transition: "all 0.2s"
              }}
              title="Enter Focus Mode"
            >
              <FocusIcon fontSize="small" />
            </IconButton>
          </Box>
          
          <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
            <Box>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block" }}>Incoming</Typography>
              <Typography sx={{ fontWeight: 700, color: "var(--accent)" }}>{neighborCounts.in}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block" }}>Outgoing</Typography>
              <Typography sx={{ fontWeight: 700, color: "var(--primary)" }}>{neighborCounts.out}</Typography>
            </Box>
            {(selectedNode.data?.metadata as any)?.lineCount && (
              <Box>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block" }}>Lines</Typography>
                <Typography sx={{ fontWeight: 700 }}>{(selectedNode.data?.metadata as any).lineCount}</Typography>
              </Box>
            )}
          </Box>

          {/* Find All References (Incoming Edges) */}
          <Box>
            <Typography 
              variant="caption" 
              sx={{ 
                color: "rgba(255,255,255,0.4)", 
                fontWeight: 700, 
                textTransform: "uppercase", 
                letterSpacing: "0.05em",
                display: "block",
                mb: 1
              }}
            >
              References ({neighborCounts.in})
            </Typography>
            {neighborCounts.in === 0 ? (
              <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                No incoming references found
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {edges
                  .filter(e => e.target === selectedNodeId)
                  .map((e, idx) => {
                    const sourceNode = nodes.find(n => n.id === e.source);
                    if (!sourceNode) return null;
                    return (
                      <ListItemButton
                        key={`${e.id}-${idx}`}
                        onClick={() => panToNode(sourceNode.id)}
                        sx={{
                          py: 0.5,
                          px: 1,
                          borderRadius: 1,
                          bgcolor: "rgba(255,255,255,0.03)",
                          "&:hover": { bgcolor: "rgba(255,255,255,0.08)" }
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                          <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {sourceNode.data?.label}
                          </Typography>
                          <Chip 
                            label={e.type || e.label || "ref"} 
                            size="small" 
                            sx={{ height: 16, fontSize: "0.5625rem", bgcolor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }} 
                          />
                        </Box>
                      </ListItemButton>
                    );
                  })
                }
              </Box>
            )}
          </Box>
        </Box>
      )}

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
              sublabel: `[${p.pattern.toUpperCase()}] ${p.confidence} confidence`,
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
          <EdgeStat
            label="Imports"
            count={
              edges.filter(
                (e) =>
                  e.label === "uses" ||
                  e.type === "import" ||
                  (!e.label && !e.type)
              ).length
            }
            color="var(--primary)"
          />
          <EdgeStat
            label="Extends"
            count={
              edges.filter(
                (e) => e.label === "extends" || e.type === "extends"
              ).length
            }
            color="var(--secondary)"
          />
          <EdgeStat
            label="Implements"
            count={
              edges.filter(
                (e) => e.label === "implements" || e.type === "implements"
              ).length
            }
            color="var(--accent)"
          />
        </Box>
      </Box>
    </Drawer>
  );
}
