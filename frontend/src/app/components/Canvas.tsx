"use client";

import React, { useMemo, useEffect, useRef, useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Box, Typography, IconButton, Chip, Button, Tooltip } from "@mui/material";
import {
  Close as CloseIcon,
  FilterCenterFocus as FocusIcon,
  Label as LabelIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
  LocalFireDepartment as FlameIcon,
  FileDownload as DownloadIcon,
  Code as CodeIcon,
} from "@mui/icons-material";

import { useAtlasStore, getVisibleNodes, getVisibleEdges } from "../store/atlas-store";
import dynamic from "next/dynamic";

const Graph3D = dynamic(() => import("./Graph3D"), { ssr: false });
import CodePeekPanel from "./CodePeekPanel";
import { exportToMermaid, exportToJSON } from "../lib/export-utils";
import ClassNode from "./nodes/ClassNode";
import InterfaceNode from "./nodes/InterfaceNode";
import FunctionNode from "./nodes/FunctionNode";
import FileNode from "./nodes/FileNode";
import GroupNode from "./nodes/GroupNode";
import DatabaseNode from "./nodes/DatabaseNode";

// nodeTypes defined outside component to avoid re-creation
const nodeTypes = {
  class: ClassNode,
  interface: InterfaceNode,
  function: FunctionNode,
  file: FileNode,
  group: GroupNode,
  database: DatabaseNode,
};

// Inner component that uses useReactFlow (must be inside ReactFlowProvider)
function CanvasInner() {
  const allNodes = useAtlasStore((s) => s.nodes);
  const allEdges = useAtlasStore((s) => s.edges);
  const analysisResults = useAtlasStore((s) => s.analysisResults);
  const searchQuery = useAtlasStore((s) => s.searchQuery);
  const focusPath = useAtlasStore((s) => s.focusPath);
  const expandedFiles = useAtlasStore((s) => s.expandedFiles);
  const focusedNodeId = useAtlasStore((s) => s.focusedNodeId);
  const onNodesChange = useAtlasStore((s) => s.onNodesChange);
  const onEdgesChange = useAtlasStore((s) => s.onEdgesChange);
  const setSelectedNode = useAtlasStore((s) => s.setSelectedNode);
  const toggleFileExpansion = useAtlasStore((s) => s.toggleFileExpansion);
  const setFocusPath = useAtlasStore((s) => s.setFocusPath);
  const setFocusedNode = useAtlasStore((s) => s.setFocusedNode);
  const fitViewTrigger = useAtlasStore((s) => s.fitViewTrigger);
  const panToNodeId = useAtlasStore((s) => s.panToNodeId);
  const panToNode = useAtlasStore((s) => s.panToNode);
  const visibleNodeTypes = useAtlasStore((s) => s.visibleNodeTypes);
  const showEdgeLabels = useAtlasStore((s) => s.showEdgeLabels);
  const expandAllFiles = useAtlasStore((s) => s.expandAllFiles);
  const collapseAllFiles = useAtlasStore((s) => s.collapseAllFiles);
  const toggleNodeType = useAtlasStore((s) => s.toggleNodeType);
  const toggleEdgeLabels = useAtlasStore((s) => s.toggleEdgeLabels);
  const activeRepoId = useAtlasStore((s) => s.activeRepoId);
  const codePeekFile = useAtlasStore((s) => s.codePeekFile);
  const setCodePeekFile = useAtlasStore((s) => s.setCodePeekFile);
  const heatmapEnabled = useAtlasStore((s) => s.heatmapEnabled);
  const toggleHeatmap = useAtlasStore((s) => s.toggleHeatmap);
  const graphMode = useAtlasStore((s) => s.graphMode);
  const setGraphMode = useAtlasStore((s) => s.setGraphMode);
  const setSnackbarMessage = useAtlasStore((s) => s.setSnackbarMessage);

  const { fitView } = useReactFlow();
  const prevFocusPath = useRef(focusPath);

  // Filter nodes based on current focus path and type filters
  const visibleNodes = useMemo(
    () => getVisibleNodes(allNodes, focusPath, expandedFiles, visibleNodeTypes),
    [allNodes, focusPath, expandedFiles, visibleNodeTypes]
  );

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes]
  );

  const visibleEdges = useMemo(
    () => getVisibleEdges(allEdges, visibleNodeIds),
    [allEdges, visibleNodeIds]
  );

  // Pre-calculate which edges belong to a cycle
  const cycleEdges = useMemo(() => {
    const cycleSet = new Set<string>();
    const cycles = analysisResults?.cycles || [];
    for (const cycle of cycles) {
      for (let i = 0; i < cycle.length; i++) {
        const source = cycle[i];
        const target = cycle[(i + 1) % cycle.length];
        cycleSet.add(`${source}->${target}`);
      }
    }
    return cycleSet;
  }, [analysisResults?.cycles]);

  const styledEdges = useMemo(() => {
    return visibleEdges.map((edge) => {
      let color = "var(--primary)";
      let strokeDasharray = "";
      const isCycle = cycleEdges.has(`${edge.source}->${edge.target}`);

      if (isCycle) {
        color = "var(--god-object)";
        strokeDasharray = "5,5";
      } else {
        if (edge.label === "imports") color = "var(--primary)";
        if (edge.label === "implements") color = "var(--accent)";
        if (edge.label === "extends") color = "var(--secondary)";
        if (edge.label === "calls") color = "#f59e0b";
      }

      return {
        ...edge,
        label: showEdgeLabels ? edge.label : undefined,
        style: {
          ...edge.style,
          stroke: color,
          strokeDasharray: strokeDasharray,
        },
      };
    });
  }, [visibleEdges, cycleEdges, showEdgeLabels]);

  // Apply search filtering
  const styledNodes = useMemo(() => {
    if (!searchQuery) return visibleNodes;
    const lowerQuery = searchQuery.toLowerCase();

    return visibleNodes.map((node) => {
      const label = (node.data?.label as string) || node.id;
      const matches = label.toLowerCase().includes(lowerQuery);

      return {
        ...node,
        style: {
          ...node.style,
          opacity: matches ? 1 : 0.2,
          filter: matches ? "none" : "grayscale(100%)",
        },
      };
    });
  }, [visibleNodes, searchQuery]);

  // --- SEAMLESS GATHER LOGIC (Proximity Focus) ---
  const selectedNodeId = useAtlasStore((s) => s.selectedNodeId);

  const finalNodes = useMemo(() => {
    // If in ISOLATED focus mode, use the existing radial layout logic
    if (focusedNodeId) {
      const centerNode = allNodes.find(n => n.id === focusedNodeId);
      if (!centerNode) return styledNodes;

      const neighborIds = new Set<string>();
      allEdges.forEach(e => {
        if (e.source === focusedNodeId) neighborIds.add(e.target);
        if (e.target === focusedNodeId) neighborIds.add(e.source);
      });

      const focusNodes = allNodes.filter(n => n.id === focusedNodeId || neighborIds.has(n.id));
      const radius = 350;
      const neighbors = focusNodes.filter(n => n.id !== focusedNodeId);
      const angleStep = (2 * Math.PI) / Math.max(1, neighbors.length);
      
      return focusNodes.map((n) => {
        if (n.id === focusedNodeId) {
          return { ...n, position: { x: 0, y: 0 }, parentId: undefined, style: { ...n.style, opacity: 1, filter: 'none' } };
        }
        const index = neighbors.findIndex(m => m.id === n.id);
        const angle = index * angleStep;
        return {
          ...n,
          position: { x: radius * Math.cos(angle), y: radius * Math.sin(angle) },
          parentId: undefined,
          style: { ...n.style, opacity: 1, filter: 'none' }
        };
      });
    }

    // --- Proximity Focus Logic (Radial Hover) ---
    if (selectedNodeId) {
      const selectedNode = allNodes.find(n => n.id === selectedNodeId);
      if (!selectedNode) return styledNodes;

      // Helper to calculate absolute position
      const getAbsolutePosition = (nodeId: string) => {
        let curr = allNodes.find(n => n.id === nodeId);
        let x = 0;
        let y = 0;
        while (curr) {
          x += curr.position.x;
          y += curr.position.y;
          curr = curr.parentId ? allNodes.find(n => n.id === curr!.parentId) : undefined;
        }
        return { x, y };
      };

      const absCenter = getAbsolutePosition(selectedNodeId);
      
      // Calculate true center of the selected node (assuming ~250px width if not measured)
      const centerNodeWidth = selectedNode.measured?.width || selectedNode.width || 250;
      const centerNodeHeight = selectedNode.measured?.height || selectedNode.height || 100;
      const trueCenterX = absCenter.x + centerNodeWidth / 2;
      const trueCenterY = absCenter.y + centerNodeHeight / 2;

      // Find neighbors
      const neighborSet = new Set<string>();
      allEdges.forEach(e => {
        if (e.source === selectedNodeId) neighborSet.add(e.target);
        if (e.target === selectedNodeId) neighborSet.add(e.source);
      });
      
      const neighborArray = Array.from(neighborSet);
      
      // Significantly increase radius to account for wide rectangular nodes
      const radius = Math.max(400, neighborArray.length * 100); 
      const angleStep = (2 * Math.PI) / Math.max(1, neighborArray.length);

      return styledNodes.map(node => {
        const isSelected = node.id === selectedNodeId;
        const isNeighbor = neighborSet.has(node.id);

        if (isSelected) {
          return { 
            ...node, 
            parentId: undefined, // Detach to float
            position: absCenter, // Keep selected node exactly where it was
            style: { ...node.style, opacity: 1, filter: 'none', zIndex: 1000 } 
          };
        }

        if (isNeighbor) {
          const index = neighborArray.indexOf(node.id);
          const angle = index * angleStep;
          
          const nodeWidth = node.measured?.width || node.width || 250;
          const nodeHeight = node.measured?.height || node.height || 100;
          
          return { 
            ...node, 
            parentId: undefined, // Detach to float freely
            position: {
              // Position the center of the neighbor at the exact ring coordinate
              x: trueCenterX + radius * Math.cos(angle) - nodeWidth / 2,
              y: trueCenterY + radius * Math.sin(angle) - nodeHeight / 2,
            },
            style: { ...node.style, opacity: 1, filter: 'none', zIndex: 900 } 
          };
        }

        // Fade out unrelated nodes
        return {
          ...node,
          style: { ...node.style, opacity: 0.1, filter: 'grayscale(100%)', pointerEvents: 'none' as const }
        };
      });
    }

    return styledNodes;
  }, [focusedNodeId, selectedNodeId, allNodes, allEdges, styledNodes]);

  const finalEdges = useMemo(() => {
    const nodeIds = new Set(finalNodes.map(n => n.id));
    let edges = styledEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    if (focusedNodeId || selectedNodeId) {
      const activeId = focusedNodeId || selectedNodeId;
      return edges.map(e => {
        const isActive = e.source === activeId || e.target === activeId;
        return {
          ...e,
          animated: isActive,
          label: isActive ? e.label : undefined, // Hide text for unconnected edges
          style: { ...e.style, opacity: isActive ? 1 : 0.05 }
        };
      });
    }

    return edges;
  }, [focusedNodeId, selectedNodeId, finalNodes, styledEdges]);

  // Auto fit-view when focus mode toggles
  useEffect(() => {
    if (focusedNodeId) {
      setTimeout(() => {
        fitView({ padding: 0.5, duration: 600 });
      }, 100);
    }
  }, [focusedNodeId, fitView]);

  // Auto fit-view when focus path changes
  useEffect(() => {
    if (prevFocusPath.current !== focusPath) {
      prevFocusPath.current = focusPath;
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 400 });
      }, 150);
    }
  }, [focusPath, fitView]);

  // Handle explicit fitView trigger
  useEffect(() => {
    if (fitViewTrigger > 0) {
      fitView({ padding: 0.1, duration: 400 });
    }
  }, [fitViewTrigger, fitView]);

  // --- GUIDED TOUR & INITIAL FOCUS ---
  const entryPoint = useAtlasStore(s => s.entryPoint);
  const hasGuidedTourShown = useAtlasStore(s => s.hasGuidedTourShown);
  const setHasGuidedTourShown = useAtlasStore(s => s.setHasGuidedTourShown);
  const [showTourOverlay, setShowTourOverlay] = React.useState(false);

  // Auto-focus entry point on first load
  useEffect(() => {
    if (allNodes.length > 0 && !hasGuidedTourShown && entryPoint) {
      const entryNode = allNodes.find(n => n.data?.filePath === entryPoint.entryFile && n.type === 'file');
      if (entryNode) {
        // Give time for the graph to render and layout
        setTimeout(() => {
          panToNode(entryNode.id);
          setShowTourOverlay(true);
          setHasGuidedTourShown(true);
        }, 1500);
      }
    }
  }, [allNodes, entryPoint, hasGuidedTourShown, panToNode, setHasGuidedTourShown]);

  // Handle pan to specific node
  useEffect(() => {
    if (panToNodeId) {
      const node = allNodes.find(n => n.id === panToNodeId);
      if (node) {
        fitView({
          nodes: [{ id: panToNodeId }],
          duration: 800,
          padding: 3.0,
        });
        setTimeout(() => panToNode(null), 1200);
      }
    }
  }, [panToNodeId, allNodes, fitView, panToNode]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNode(node.id);
    if (node.type === 'file' && node.data?.filePath) {
      toggleFileExpansion(node.data.filePath);
    }
  }, [setSelectedNode, toggleFileExpansion]);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: any) => {
    setFocusedNode(node.id);
  }, [setFocusedNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const edgeOptions = useMemo(() => ({
    style: { strokeWidth: 2 },
    animated: true,
  }), []);

  return (
    <Box sx={{ width: "100%", height: "100%", position: "relative" }}>
      {graphMode === "3D" ? (
        <Graph3D />
      ) : (
        <ReactFlow
          nodes={finalNodes}
          edges={finalEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.05}
          maxZoom={2}
          colorMode="dark"
          defaultEdgeOptions={edgeOptions}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(255, 255, 255, 0.05)"
          />
          <Controls />
          <MiniMap
            pannable
            zoomable
            style={{ backgroundColor: "var(--glass-bg)" }}
            nodeColor={(n) => {
              if (n.type === "class") return "var(--class-bg)";
              if (n.type === "interface") return "var(--interface-bg)";
              if (n.type === "function") return "var(--function-bg)";
              if (n.type === "database") return "#10b981";
              return "var(--file-bg)";
            }}
            maskColor="rgba(0, 0, 0, 0.5)"
          />
        </ReactFlow>
      )}

      {/* Floating Canvas Toolbar */}
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
            p: 0.25 
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
              }
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
              }
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
            label={`${allNodes.filter(n => n.type === 'file').length} Files`}
            size="small"
            sx={{ bgcolor: "rgba(255, 255, 255, 0.04)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.06)", fontSize: "0.6875rem", height: 20 }}
          />
          <Chip
            label={`${allEdges.length} Connections`}
            size="small"
            sx={{ bgcolor: "rgba(255, 255, 255, 0.04)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.06)", fontSize: "0.6875rem", height: 20 }}
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
                    bgcolor: isActive ? `${color}25` : "rgba(255,255,255,0.04)",
                  }
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

      {/* Focus Mode Overlay */}
      {focusedNodeId && (
        <Box
          sx={{
            position: "absolute",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(15, 15, 20, 0.8)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(99, 102, 241, 0.5)",
            borderRadius: 4,
            px: 3,
            py: 1,
            display: "flex",
            alignItems: "center",
            gap: 2,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          <FocusIcon sx={{ color: "#818cf8" }} />
          <Box>
            <Typography sx={{ color: "white", fontSize: "0.875rem", fontWeight: 700 }}>
              Isolated Focus Mode
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>
              Showing connections for {allNodes.find(n => n.id === focusedNodeId)?.data?.label || 'selected node'}
            </Typography>
          </Box>
          <IconButton 
            size="small" 
            onClick={() => setFocusedNode(null)}
            sx={{ color: "white", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Selected Node Code Peek Overlay Trigger */}
      {selectedNodeId && activeRepoId && allNodes.find(n => n.id === selectedNodeId)?.data?.filePath && (
        <Box
          sx={{
            position: "absolute",
            top: 80,
            right: 20,
            zIndex: 1000,
            background: "rgba(10, 10, 12, 0.85)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 2.5,
            px: 2,
            py: 1,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
          }}
        >
          <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
            Selected: <b>{allNodes.find(n => n.id === selectedNodeId)?.data?.label}</b>
          </Typography>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              const sel = allNodes.find(n => n.id === selectedNodeId);
              if (sel && sel.data?.filePath) {
                setCodePeekFile({ filePath: sel.data.filePath, label: sel.data.label });
              }
            }}
            startIcon={<CodeIcon sx={{ fontSize: 10 }} />}
            sx={{
              fontSize: "0.6875rem",
              py: 0.25,
              px: 1.5,
              borderRadius: 2,
              textTransform: "none",
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              "&:hover": {
                background: "linear-gradient(135deg, #4338ca, #6d28d9)",
              }
            }}
          >
            Peek Code
          </Button>
        </Box>
      )}

      {/* Guided Tour Overlay */}
      {showTourOverlay && (
        <Box
          sx={{
            position: "absolute",
            bottom: 40,
            right: 40,
            zIndex: 2000,
            width: 280,
            background: "linear-gradient(135deg, rgba(79, 70, 229, 0.95), rgba(124, 58, 237, 0.95))",
            backdropFilter: "blur(10px)",
            borderRadius: 4,
            p: 3,
            boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
            animation: "slideUp 0.5s ease-out",
            "@keyframes slideUp": {
              from: { transform: "translateY(20px)", opacity: 0 },
              to: { transform: "translateY(0)", opacity: 1 },
            },
          }}
        >
          <Typography sx={{ color: "white", fontSize: "1rem", fontWeight: 800, mb: 1 }}>
            🎯 Start Here
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.8)", fontSize: "0.8125rem", lineHeight: 1.5, mb: 2 }}>
            We've detected the <b>{entryPoint?.framework}</b> entry point at <code>{entryPoint?.entryFile}</code>. 
            Follow the arrows to see how the code flows!
          </Typography>
          <Button 
            fullWidth
            onClick={() => setShowTourOverlay(false)}
            sx={{ 
              bgcolor: "white", 
              color: "#4f46e5", 
              fontWeight: 700,
              fontSize: "0.75rem",
              borderRadius: 2,
              "&:hover": { bgcolor: "rgba(255,255,255,0.9)" }
            }}
          >
            Got it, thanks!
          </Button>
        </Box>
      )}

      {/* Code Peek Sidebar Drawer */}
      <CodePeekPanel />
    </Box>
  );
}

// Wrapper that provides ReactFlowProvider context
const Canvas = () => {
  return (
    <div className="canvas-wrapper">
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
};

export default Canvas;
