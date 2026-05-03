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
import { Box, Typography, IconButton, Chip } from "@mui/material";
import { Close as CloseIcon, FilterCenterFocus as FocusIcon } from "@mui/icons-material";

import { useAtlasStore, getVisibleNodes, getVisibleEdges } from "../store/atlas-store";
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
  const {
    nodes: allNodes,
    edges: allEdges,
    analysisResults,
    searchQuery,
    focusPath,
    expandedFiles,
    focusedNodeId,
    onNodesChange,
    onEdgesChange,
    setSelectedNode,
    toggleFileExpansion,
    setFocusPath,
    setFocusedNode,
    fitViewTrigger,
    panToNodeId,
    panToNode,
  } = useAtlasStore();

  const { fitView } = useReactFlow();
  const prevFocusPath = useRef(focusPath);

  // Filter nodes based on current focus path
  const visibleNodes = useMemo(
    () => getVisibleNodes(allNodes, focusPath, expandedFiles),
    [allNodes, focusPath, expandedFiles]
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
        if (edge.label === "implements") color = "var(--accent)";
        if (edge.label === "extends") color = "var(--secondary)";
        if (edge.label === "calls") color = "var(--primary)";
      }

      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: color,
          strokeDasharray: strokeDasharray,
        },
      };
    });
  }, [visibleEdges, cycleEdges]);

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

    // --- Proximity Focus Logic (Gathering) ---
    if (selectedNodeId) {
      const selectedNode = allNodes.find(n => n.id === selectedNodeId);
      if (!selectedNode) return styledNodes;

      // Find neighbors
      const neighbors = new Set<string>();
      allEdges.forEach(e => {
        if (e.source === selectedNodeId) neighbors.add(e.target);
        if (e.target === selectedNodeId) neighbors.add(e.source);
      });

      return styledNodes.map(node => {
        const isSelected = node.id === selectedNodeId;
        const isNeighbor = neighbors.has(node.id);

        if (isSelected) {
          return { ...node, style: { ...node.style, opacity: 1, filter: 'none', zIndex: 1000 } };
        }

        if (isNeighbor) {
          // Pull neighbors slightly closer to the selected node
          const dx = node.position.x - selectedNode.position.x;
          const dy = node.position.y - selectedNode.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const targetDist = 300; // Desired distance
          
          if (dist > targetDist) {
            const ratio = targetDist / dist;
            return {
              ...node,
              position: {
                x: selectedNode.position.x + dx * ratio,
                y: selectedNode.position.y + dy * ratio,
              },
              style: { ...node.style, opacity: 1, filter: 'none' }
            };
          }
          return { ...node, style: { ...node.style, opacity: 1, filter: 'none' } };
        }

        // Fade out unrelated nodes
        return {
          ...node,
          style: { ...node.style, opacity: 0.2, filter: 'grayscale(100%)' }
        };
      });
    }

    return styledNodes;
  }, [focusedNodeId, selectedNodeId, allNodes, allEdges, styledNodes]);

  const finalEdges = useMemo(() => {
    const nodeIds = new Set(finalNodes.map(n => n.id));
    let edges = allEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    if (focusedNodeId || selectedNodeId) {
      const activeId = focusedNodeId || selectedNodeId;
      return edges.map(e => {
        const isActive = e.source === activeId || e.target === activeId;
        return {
          ...e,
          animated: isActive,
          style: { ...e.style, opacity: isActive ? 1 : 0.1 }
        };
      });
    }

    return styledEdges;
  }, [focusedNodeId, selectedNodeId, finalNodes, allEdges, styledEdges]);

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

  // Handle pan to specific node
  useEffect(() => {
    if (panToNodeId) {
      const node = allNodes.find(n => n.id === panToNodeId);
      if (node) {
        fitView({
          nodes: [{ id: panToNodeId }],
          duration: 600,
          padding: 3.0,
        });
        setTimeout(() => panToNode(null), 1000);
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

      {/* Focus Mode Overlay */}
      {focusedNodeId && (
        <Box
          sx={{
            position: "absolute",
            top: 20,
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
