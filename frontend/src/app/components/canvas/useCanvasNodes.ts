"use client";

import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useAtlasStore, getVisibleNodes, getVisibleEdges } from "../../store/atlas-store";
import type { AtlasNode } from "../../types/nodes";

export function useCanvasNodes() {
  const allNodes = useAtlasStore((s) => s.nodes);
  const allEdges = useAtlasStore((s) => s.edges);
  const analysisResults = useAtlasStore((s) => s.analysisResults);
  const searchQuery = useAtlasStore((s) => s.searchQuery);
  const focusPath = useAtlasStore((s) => s.focusPath);
  const expandedFiles = useAtlasStore((s) => s.expandedFiles);
  const focusedNodeId = useAtlasStore((s) => s.focusedNodeId);
  const selectedNodeId = useAtlasStore((s) => s.selectedNodeId);
  
  const onNodesChange = useAtlasStore((s) => s.onNodesChange);
  const onEdgesChange = useAtlasStore((s) => s.onEdgesChange);
  const setSelectedNode = useAtlasStore((s) => s.setSelectedNode);
  const toggleFileExpansion = useAtlasStore((s) => s.toggleFileExpansion);
  const setFocusedNode = useAtlasStore((s) => s.setFocusedNode);
  const fitViewTrigger = useAtlasStore((s) => s.fitViewTrigger);
  const panToNodeId = useAtlasStore((s) => s.panToNodeId);
  const panToNode = useAtlasStore((s) => s.panToNode);
  const visibleNodeTypes = useAtlasStore((s) => s.visibleNodeTypes);
  const showEdgeLabels = useAtlasStore((s) => s.showEdgeLabels);

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
        if (source && target) {
          cycleSet.add(`${source}->${target}`);
        }
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
        const relation = edge.data?.relation;
        if (relation === "import") color = "var(--primary)";
        if (relation === "implements") color = "var(--accent)";
        if (relation === "extends") color = "var(--secondary)";
        if (relation === "calls") color = "#f59e0b";
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

  const finalNodes = useMemo(() => {
    // If in ISOLATED focus mode, use the existing radial layout logic
    if (focusedNodeId) {
      const centerNode = allNodes.find((n) => n.id === focusedNodeId);
      if (!centerNode) return styledNodes;

      const neighborIds = new Set<string>();
      allEdges.forEach((e) => {
        if (e.source === focusedNodeId) neighborIds.add(e.target);
        if (e.target === focusedNodeId) neighborIds.add(e.source);
      });

      const focusNodes = allNodes.filter((n) => n.id === focusedNodeId || neighborIds.has(n.id));
      const radius = 350;
      const neighbors = focusNodes.filter((n) => n.id !== focusedNodeId);
      const angleStep = (2 * Math.PI) / Math.max(1, neighbors.length);

      return focusNodes.map((n) => {
        if (n.id === focusedNodeId) {
          return {
            ...n,
            position: { x: 0, y: 0 },
            parentId: undefined,
            style: { ...n.style, opacity: 1, filter: "none" },
          };
        }
        const index = neighbors.findIndex((m) => m.id === n.id);
        const angle = index * angleStep;
        return {
          ...n,
          position: { x: radius * Math.cos(angle), y: radius * Math.sin(angle) },
          parentId: undefined,
          style: { ...n.style, opacity: 1, filter: "none" },
        };
      });
    }

    // --- Proximity Focus Logic (Radial Hover) ---
    if (selectedNodeId) {
      const selectedNode = allNodes.find((n) => n.id === selectedNodeId);
      if (!selectedNode) return styledNodes;

      // Helper to calculate absolute position
      const getAbsolutePosition = (nodeId: string) => {
        let curr = allNodes.find((n) => n.id === nodeId);
        let x = 0;
        let y = 0;
        while (curr) {
          x += curr.position.x;
          y += curr.position.y;
          curr = curr.parentId ? allNodes.find((n) => n.id === curr!.parentId) : undefined;
        }
        return { x, y };
      };

      const absCenter = getAbsolutePosition(selectedNodeId);

      // Calculate true center of the selected node
      const centerNodeWidth = selectedNode.measured?.width || selectedNode.width || 250;
      const centerNodeHeight = selectedNode.measured?.height || selectedNode.height || 100;
      const trueCenterX = absCenter.x + centerNodeWidth / 2;
      const trueCenterY = absCenter.y + centerNodeHeight / 2;

      // Find neighbors
      const neighborSet = new Set<string>();
      allEdges.forEach((e) => {
        if (e.source === selectedNodeId) neighborSet.add(e.target);
        if (e.target === selectedNodeId) neighborSet.add(e.source);
      });

      const neighborArray = Array.from(neighborSet);
      const radius = Math.max(400, neighborArray.length * 100);
      const angleStep = (2 * Math.PI) / Math.max(1, neighborArray.length);

      return styledNodes.map((node) => {
        const isSelected = node.id === selectedNodeId;
        const isNeighbor = neighborSet.has(node.id);

        if (isSelected) {
          return {
            ...node,
            parentId: undefined, // Detach to float
            position: absCenter,
            style: { ...node.style, opacity: 1, filter: "none", zIndex: 1000 },
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
              x: trueCenterX + radius * Math.cos(angle) - nodeWidth / 2,
              y: trueCenterY + radius * Math.sin(angle) - nodeHeight / 2,
            },
            style: { ...node.style, opacity: 1, filter: "none", zIndex: 900 },
          };
        }

        return {
          ...node,
          style: {
            ...node.style,
            opacity: 0.1,
            filter: "grayscale(100%)",
            pointerEvents: "none" as const,
          },
        };
      });
    }

    return styledNodes;
  }, [focusedNodeId, selectedNodeId, allNodes, allEdges, styledNodes]);

  const finalEdges = useMemo(() => {
    const nodeIds = new Set(finalNodes.map((n) => n.id));
    const edges = styledEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    // Index once — this used to be two linear scans per edge, i.e. O(N*E).
    const nodeById = new Map(finalNodes.map((n) => [n.id, n]));

    return edges.map((e) => {
      const sourceNode = nodeById.get(e.source);
      const targetNode = nodeById.get(e.target);

      const sourceOpacity = sourceNode?.style?.opacity !== undefined ? Number(sourceNode.style.opacity) : 1;
      const targetOpacity = targetNode?.style?.opacity !== undefined ? Number(targetNode.style.opacity) : 1;
      const minNodeOpacity = Math.min(sourceOpacity, targetOpacity);

      if (focusedNodeId || selectedNodeId) {
        const activeId = focusedNodeId || selectedNodeId;
        const isActive = e.source === activeId || e.target === activeId;
        const opacity = isActive ? minNodeOpacity : Math.min(0.05, minNodeOpacity);
        return {
          ...e,
          animated: isActive,
          label: isActive ? e.label : undefined,
          style: { ...e.style, opacity },
        };
      }

      return {
        ...e,
        style: { ...e.style, opacity: minNodeOpacity },
      };
    });
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

  // Handle pan to specific node
  useEffect(() => {
    if (panToNodeId) {
      const node = allNodes.find((n) => n.id === panToNodeId);
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

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: AtlasNode) => {
      setSelectedNode(node.id);
      if (node.type === "file" && node.data?.filePath) {
        toggleFileExpansion(node.data.filePath as string);
      }
    },
    [setSelectedNode, toggleFileExpansion]
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: AtlasNode) => {
      setFocusedNode(node.id);
    },
    [setFocusedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const edgeOptions = useMemo(
    () => ({
      style: { strokeWidth: 2 },
      animated: true,
    }),
    []
  );

  return {
    finalNodes,
    finalEdges,
    onNodesChange,
    onEdgesChange,
    onNodeClick,
    onNodeDoubleClick,
    onPaneClick,
    edgeOptions,
  };
}
