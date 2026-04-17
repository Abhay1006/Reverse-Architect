"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useAtlasStore } from "../store/atlas-store";
import ClassNode from "./nodes/ClassNode";
import InterfaceNode from "./nodes/InterfaceNode";
import FunctionNode from "./nodes/FunctionNode";
import FileNode from "./nodes/FileNode";

const Canvas = () => {
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    setSelectedNode 
  } = useAtlasStore();

  const nodeTypes = useMemo(() => ({
    class: ClassNode,
    interface: InterfaceNode,
    function: FunctionNode,
    file: FileNode,
  }), []);

  const onNodeClick = (_: React.MouseEvent, node: any) => {
    setSelectedNode(node.id);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  const edgeOptions = {
    style: { strokeWidth: 2 },
    animated: true,
  };

  const styledEdges = useMemo(() => {
    return edges.map((edge) => {
      let color = "var(--primary)";
      let strokeDasharray = "";

      if (edge.label === "implements") color = "var(--accent)";
      if (edge.label === "extends") color = "var(--secondary)";
      if (edge.label === "calls") color = "var(--primary)";

      return {
        ...edge,
        style: { 
          ...edge.style, 
          stroke: color,
          strokeDasharray: strokeDasharray,
        },
      };
    });
  }, [edges]);

  return (
    <div className="w-full h-screen">
      <ReactFlow
        nodes={nodes}
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
          style={{ backgroundColor: "var(--glass-bg)" }}
          nodeColor={(n) => {
            if (n.type === 'class') return 'var(--class-bg)';
            if (n.type === 'interface') return 'var(--interface-bg)';
            if (n.type === 'function') return 'var(--function-bg)';
            return 'var(--file-bg)';
          }}
          maskColor="rgba(0, 0, 0, 0.5)"
        />
      </ReactFlow>
    </div>
  );
};

export default Canvas;
