"use client";

import React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Box } from "@mui/material";
import dynamic from "next/dynamic";

import { useAtlasStore } from "../store/atlas-store";

// Extracted canvas components & hooks
import { useCanvasNodes } from "./canvas/useCanvasNodes";
import CanvasToolbar from "./canvas/CanvasToolbar";
import FocusModeOverlay from "./canvas/FocusModeOverlay";
import CodePeekOverlay from "./canvas/CodePeekOverlay";
import GuidedTourOverlay from "./canvas/GuidedTourOverlay";

const Graph3D = dynamic(() => import("./Graph3D"), { ssr: false });
import CodePeekPanel from "./CodePeekPanel";
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

function CanvasInner() {
  const graphMode = useAtlasStore((s) => s.graphMode);
  
  const {
    finalNodes,
    finalEdges,
    onNodesChange,
    onEdgesChange,
    onNodeClick,
    onNodeDoubleClick,
    onPaneClick,
    edgeOptions,
  } = useCanvasNodes();

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
      <CanvasToolbar />

      {/* Focus Mode Overlay */}
      <FocusModeOverlay />

      {/* Selected Node Code Peek Overlay Trigger */}
      <CodePeekOverlay />

      {/* Guided Tour Overlay */}
      <GuidedTourOverlay />

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
