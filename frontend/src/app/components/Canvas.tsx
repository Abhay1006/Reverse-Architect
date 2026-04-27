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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

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
    onNodesChange,
    onEdgesChange,
    setSelectedNode,
    fitViewTrigger,
    panToNodeId,
    panToNode,
  } = useAtlasStore();

  const { fitView } = useReactFlow();
  const prevFocusPath = useRef(focusPath);

  // Filter nodes based on current focus path
  const visibleNodes = useMemo(
    () => getVisibleNodes(allNodes, focusPath),
    [allNodes, focusPath]
  );

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes]
  );

  const visibleEdges = useMemo(
    () => getVisibleEdges(allEdges, visibleNodeIds),
    [allEdges, visibleNodeIds]
  );

  // Auto fit-view when focus path changes
  useEffect(() => {
    if (prevFocusPath.current !== focusPath) {
      prevFocusPath.current = focusPath;
      // Small delay to let React Flow render the new nodes
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
        // We use fitView with just this node to "zoom to" it comfortably
        fitView({
          nodes: [{ id: panToNodeId }],
          duration: 600,
          padding: 3.0, // High padding to show some context around the node
        });
        
        // Reset the trigger in store after a delay to allow future pans to same node
        setTimeout(() => panToNode(null), 1000);
      }
    }
  }, [panToNodeId, allNodes, fitView, panToNode]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNode(node.id);
  }, [setSelectedNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const edgeOptions = useMemo(() => ({
    style: { strokeWidth: 2 },
    animated: true,
  }), []);

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

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={styledEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
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
          if (n.type === "group") return "rgba(255, 255, 255, 0.05)";
          return "var(--file-bg)";
        }}
        maskColor="rgba(0, 0, 0, 0.5)"
      />
    </ReactFlow>
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
