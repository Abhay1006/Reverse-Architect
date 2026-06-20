"use client";

import React from "react";
import { Box, Chip, Button, Tooltip, IconButton } from "@mui/material";
import {
  Label as LabelIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
  LocalFireDepartment as FlameIcon,
  FileDownload as DownloadIcon,
  Code as CodeIcon,
} from "@mui/icons-material";
import { useAtlasStore } from "../../store/atlas-store";
import { exportToMermaid, exportToJSON } from "../../lib/export-utils";

export default function CanvasToolbar() {
  const allNodes = useAtlasStore((s) => s.nodes);
  const allEdges = useAtlasStore((s) => s.edges);
  const analysisResults = useAtlasStore((s) => s.analysisResults);
  const visibleNodeTypes = useAtlasStore((s) => s.visibleNodeTypes);
  const showEdgeLabels = useAtlasStore((s) => s.showEdgeLabels);
  const heatmapEnabled = useAtlasStore((s) => s.heatmapEnabled);
  const graphMode = useAtlasStore((s) => s.graphMode);

  const expandAllFiles = useAtlasStore((s) => s.expandAllFiles);
  const collapseAllFiles = useAtlasStore((s) => s.collapseAllFiles);
  const toggleNodeType = useAtlasStore((s) => s.toggleNodeType);
  const toggleEdgeLabels = useAtlasStore((s) => s.toggleEdgeLabels);
  const toggleHeatmap = useAtlasStore((s) => s.toggleHeatmap);
  const setGraphMode = useAtlasStore((s) => s.setGraphMode);
  const setSnackbarMessage = useAtlasStore((s) => s.setSnackbarMessage);

  return (
    <Box
      sx={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 0.75,
        borderRadius: 3,
        bgcolor: "rgba(10, 10, 12, 0.8)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* 2D / 3D Mode Toggle */}
      <Box
        sx={{
          display: "flex",
          bgcolor: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: 2,
          p: 0.25,
        }}
      >
        <Button
          size="small"
          variant={graphMode === "2D" ? "contained" : "text"}
          onClick={() => setGraphMode("2D")}
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            minWidth: 40,
            height: 20,
            py: 0,
            px: 1,
            textTransform: "none",
            borderRadius: 1.5,
            color: graphMode === "2D" ? "white" : "text.secondary",
            bgcolor: graphMode === "2D" ? "rgba(99, 102, 241, 0.85)" : "transparent",
            boxShadow: "none",
            "&:hover": {
              bgcolor: graphMode === "2D" ? "rgba(99, 102, 241, 0.95)" : "rgba(255, 255, 255, 0.04)",
            },
          }}
        >
          2D
        </Button>
        <Button
          size="small"
          variant={graphMode === "3D" ? "contained" : "text"}
          onClick={() => setGraphMode("3D")}
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            minWidth: 40,
            height: 20,
            py: 0,
            px: 1,
            textTransform: "none",
            borderRadius: 1.5,
            color: graphMode === "3D" ? "white" : "text.secondary",
            bgcolor: graphMode === "3D" ? "rgba(99, 102, 241, 0.85)" : "transparent",
            boxShadow: "none",
            "&:hover": {
              bgcolor: graphMode === "3D" ? "rgba(99, 102, 241, 0.95)" : "rgba(255, 255, 255, 0.04)",
            },
          }}
        >
          3D
        </Button>
      </Box>

      {/* Divider */}
      <Box sx={{ height: 16, width: "1px", bgcolor: "rgba(255,255,255,0.15)" }} />

      {/* Stats Section */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Chip
          label={`${allNodes.filter((n) => n.type === "file").length} Files`}
          size="small"
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.04)",
            color: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: "0.6875rem",
            height: 20,
          }}
        />
        <Chip
          label={`${allEdges.length} Connections`}
          size="small"
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.04)",
            color: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: "0.6875rem",
            height: 20,
          }}
        />
      </Box>

      {/* Divider */}
      <Box sx={{ height: 16, width: "1px", bgcolor: "rgba(255,255,255,0.15)" }} />

      {/* Expand / Collapse All */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Tooltip title="Expand all file nodes to show classes & functions">
          <IconButton
            onClick={expandAllFiles}
            size="small"
            sx={{
              color: "text.secondary",
              bgcolor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 1.5,
              p: 0.5,
              "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "text.primary" },
            }}
          >
            <ExpandAllIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Collapse all file nodes">
          <IconButton
            onClick={collapseAllFiles}
            size="small"
            sx={{
              color: "text.secondary",
              bgcolor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 1.5,
              p: 0.5,
              "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "text.primary" },
            }}
          >
            <CollapseAllIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Divider */}
      <Box sx={{ height: 16, width: "1px", bgcolor: "rgba(255,255,255,0.15)" }} />

      {/* Filters */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {(["file", "class", "interface", "function", "database"] as const).map((type) => {
          const isActive = visibleNodeTypes.has(type);
          const label = type.charAt(0).toUpperCase() + type.slice(1);
          let color = "rgba(255, 255, 255, 0.3)";
          if (isActive) {
            if (type === "class") color = "#818cf8";
            if (type === "interface") color = "#c084fc";
            if (type === "function") color = "#38bdf8";
            if (type === "database") color = "#34d399";
            if (type === "file") color = "#94a3b8";
          }
          return (
            <Chip
              key={type}
              label={label}
              size="small"
              onClick={() => toggleNodeType(type)}
              sx={{
                bgcolor: isActive ? `${color}15` : "transparent",
                color: isActive ? color : "text.secondary",
                border: `1px solid ${isActive ? `${color}35` : "rgba(255,255,255,0.06)"}`,
                fontSize: "0.6875rem",
                fontWeight: 600,
                cursor: "pointer",
                height: 22,
                transition: "all 0.15s ease",
                "&:hover": {
                  bgcolor: isActive ? `${color}25` : "rgba(255, 255, 255, 0.04)",
                },
              }}
            />
          );
        })}
      </Box>

      {/* Divider */}
      <Box sx={{ height: 16, width: "1px", bgcolor: "rgba(255,255,255,0.15)" }} />

      {/* Edge Labels */}
      <Tooltip title={showEdgeLabels ? "Hide relationship labels" : "Show relationship labels"}>
        <IconButton
          onClick={toggleEdgeLabels}
          size="small"
          sx={{
            color: showEdgeLabels ? "primary.light" : "text.secondary",
            bgcolor: showEdgeLabels ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${showEdgeLabels ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: 1.5,
            p: 0.5,
            "&:hover": {
              bgcolor: showEdgeLabels ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
            },
          }}
        >
          <LabelIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>

      {/* Divider */}
      <Box sx={{ height: 16, width: "1px", bgcolor: "rgba(255,255,255,0.15)" }} />

      {/* Complexity Heatmap */}
      <Tooltip title={heatmapEnabled ? "Disable complexity heatmap" : "Enable complexity heatmap (Low → High complexity)"}>
        <IconButton
          onClick={toggleHeatmap}
          size="small"
          sx={{
            color: heatmapEnabled ? "error.light" : "text.secondary",
            bgcolor: heatmapEnabled ? "rgba(239, 68, 68, 0.08)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${heatmapEnabled ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: 1.5,
            p: 0.5,
            "&:hover": {
              bgcolor: heatmapEnabled ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)",
            },
          }}
        >
          <FlameIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>

      {/* Divider */}
      <Box sx={{ height: 16, width: "1px", bgcolor: "rgba(255,255,255,0.15)" }} />

      {/* Export Mermaid */}
      <Tooltip title="Copy Mermaid Diagram syntax to clipboard">
        <Button
          onClick={() => {
            const mermaidCode = exportToMermaid(allNodes, allEdges);
            navigator.clipboard.writeText(mermaidCode);
            setSnackbarMessage("Mermaid code copied to clipboard!");
          }}
          size="small"
          variant="outlined"
          startIcon={<CodeIcon sx={{ fontSize: 10 }} />}
          sx={{
            color: "text.secondary",
            borderColor: "rgba(255,255,255,0.1)",
            fontSize: "0.6875rem",
            height: 22,
            px: 1,
            borderRadius: 1.5,
            textTransform: "none",
            "&:hover": {
              borderColor: "rgba(255,255,255,0.2)",
              color: "text.primary",
              background: "rgba(255,255,255,0.04)",
            },
          }}
        >
          Mermaid
        </Button>
      </Tooltip>

      {/* Export JSON */}
      <Tooltip title="Download Graph JSON file">
        <IconButton
          onClick={() => {
            const jsonStr = exportToJSON(allNodes, allEdges, analysisResults);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `atlas-graph-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          size="small"
          sx={{
            color: "text.secondary",
            bgcolor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 1.5,
            p: 0.5,
            "&:hover": {
              bgcolor: "rgba(255,255,255,0.05)",
              color: "text.primary",
            },
          }}
        >
          <DownloadIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
