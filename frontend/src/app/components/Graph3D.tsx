"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { CenterFocusStrong as FocusIcon, SettingsBackupRestore as ResetIcon } from "@mui/icons-material";
import { useAtlasStore, getVisibleNodes, getVisibleEdges } from "../store/atlas-store";

export default function Graph3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const {
    nodes: allNodes,
    edges: allEdges,
    analysisResults,
    searchQuery,
    focusPath,
    expandedFiles,
    visibleNodeTypes,
    setSelectedNode,
    selectedNodeId,
    heatmapEnabled,
  } = useAtlasStore();

  // 1. Resize observer to fit parent container
  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const observer = new ResizeObserver((entries) => {
        if (entries[0]) {
          setDimensions({
            width: entries[0].contentRect.width,
            height: entries[0].contentRect.height,
          });
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // 2. Filter nodes and edges exactly like 2D view
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

  // 3. Precalculate cycles
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

  // 4. Map nodes to force-graph 3D input format
  const graphData = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    
    const nodes = visibleNodes.map((node) => {
      const label = (node.data?.label as string) || node.id;
      const isGodObject = !!analysisResults?.godObjects.includes(node.id);
      const isDeadCode = !!analysisResults?.deadCode.includes(node.id);
      const isEntryPoint = !!node.data?.analysis?.isEntryPoint;
      const complexity = (node.data?.metadata as any)?.maxComplexity || 0;
      const lineCount = (node.data?.metadata as any)?.lineCount || 0;

      // Color mapping
      let color = "#94a3b8"; // Slate for files
      if (node.type === "class") color = "#818cf8"; // Indigo
      if (node.type === "interface") color = "#c084fc"; // Purple
      if (node.type === "function") color = "#38bdf8"; // Light Blue
      if (node.type === "database") color = "#34d399"; // Emerald Green
      if (node.type === "group") color = "rgba(255, 255, 255, 0.15)"; // Gray folder

      // Search match dimming
      let opacity = 1.0;
      if (searchQuery && !label.toLowerCase().includes(searchLower)) {
        opacity = 0.15;
      }

      // Heatmap dynamic color mapping
      if (heatmapEnabled && complexity > 0) {
        const hue = Math.max(0, 120 - complexity * 8); // Green -> Red
        color = `hsl(${hue}, 80%, 45%)`;
      }

      // Sizes
      let val = 4;
      if (node.type === "file") val = 5 + Math.min(5, lineCount / 200);
      if (node.type === "class") val = 4.5;
      if (node.type === "interface") val = 3.5;
      if (node.type === "function") val = 2.5;
      if (node.type === "database") val = 6;
      if (node.type === "group") val = 8;
      if (isGodObject) val = 9;
      if (isEntryPoint) val = 8.5;

      return {
        id: node.id,
        name: label,
        filePath: node.data?.filePath || "",
        type: node.type,
        color,
        val,
        opacity,
        isGodObject,
        isDeadCode,
        isEntryPoint,
        complexity,
        lineCount,
        parentId: node.parentId,
      };
    });

    const links = visibleEdges.map((edge) => {
      const isCycle = cycleEdges.has(`${edge.source}->${edge.target}`);
      
      let color = "rgba(99, 102, 241, 0.5)"; // Default Indigo
      if (isCycle) color = "rgba(239, 68, 68, 0.8)"; // Red cycle
      else if (edge.label === "implements") color = "rgba(168, 85, 247, 0.5)"; // Purple
      else if (edge.label === "extends") color = "rgba(236, 72, 153, 0.5)"; // Pink
      else if (edge.label === "calls") color = "rgba(245, 158, 11, 0.6)"; // Orange

      return {
        source: edge.source,
        target: edge.target,
        label: edge.label,
        color,
        isCycle,
      };
    });

    // Create weak links between child nodes and their parent group node for folder clustering
    visibleNodes.forEach(node => {
      if (node.parentId && visibleNodeIds.has(node.parentId)) {
        links.push({
          source: node.id,
          target: node.parentId,
          label: "inside",
          color: "rgba(255, 255, 255, 0.05)",
          isCycle: false,
        });
      }
    });

    return { nodes, links };
  }, [visibleNodes, visibleEdges, cycleEdges, searchQuery, heatmapEnabled, analysisResults]);

  // 5. Build premium 3D Mesh object for nodes
  const nodeThreeObject = (node: any) => {
    const size = node.val;
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    
    let material: THREE.Material;

    if (node.opacity < 0.5) {
      // Dimmed nodes (search filter miss)
      material = new THREE.MeshBasicMaterial({
        color: node.color,
        transparent: true,
        opacity: 0.1,
      });
    } else if (node.isGodObject) {
      // Glowing pulsing red emissive mesh
      material = new THREE.MeshLambertMaterial({
        color: "#ef4444",
        emissive: "#b91c1c",
        emissiveIntensity: 2.0,
      });
    } else if (node.isEntryPoint) {
      // Glowing white/indigo emissive mesh
      material = new THREE.MeshLambertMaterial({
        color: "#6366f1",
        emissive: "#4338ca",
        emissiveIntensity: 2.0,
      });
    } else if (node.type === "group") {
      // Semi-transparent cage
      material = new THREE.MeshBasicMaterial({
        color: "rgba(255,255,255,0.1)",
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      });
    } else {
      // Phong shader with clean highlights
      material = new THREE.MeshPhongMaterial({
        color: node.color,
        shininess: 80,
        specular: 0x333333,
      });
    }

    const mesh = new THREE.Mesh(geometry, material);

    // Selected glow outline
    if (selectedNodeId === node.id) {
      const outlineGeom = new THREE.SphereGeometry(size + 1.2, 16, 16);
      const outlineMat = new THREE.MeshBasicMaterial({
        color: "#38bdf8",
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      });
      const outlineMesh = new THREE.Mesh(outlineGeom, outlineMat);
      const group = new THREE.Group();
      group.add(mesh);
      group.add(outlineMesh);
      return group;
    }

    // Outer cage halo for entry point / god object
    if (node.isGodObject || node.isEntryPoint) {
      const haloGeom = new THREE.SphereGeometry(size + 2.5, 8, 8);
      const haloMat = new THREE.MeshBasicMaterial({
        color: node.isGodObject ? "#ef4444" : "#818cf8",
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      });
      const haloMesh = new THREE.Mesh(haloGeom, haloMat);
      const group = new THREE.Group();
      group.add(mesh);
      group.add(haloMesh);
      return group;
    }

    return mesh;
  };

  // 6. Camera focal point & zoom actions with manual double-click detection
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);

  const handleNodeClick = (node: any) => {
    setSelectedNode(node.id);

    const now = Date.now();
    if (lastClickRef.current && lastClickRef.current.id === node.id && (now - lastClickRef.current.time) < 300) {
      if (fgRef.current) {
        const distance = 80;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        fgRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // camera position
          node, // focus coords
          1200 // transition duration (ms)
        );
      }
      lastClickRef.current = null;
    } else {
      lastClickRef.current = { id: node.id, time: now };
    }
  };

  const resetCamera = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(1000, 50);
    }
  };

  // Force simulation settings
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force("charge").strength(-120);
      fgRef.current.d3Force("link").distance(60);
    }
  }, [fgRef.current]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        bgcolor: "#09090b",
        overflow: "hidden",
      }}
    >
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        onNodeClick={handleNodeClick}
        nodeLabel={(node: any) => {
          const typeLabel = node.type.toUpperCase();
          const info = node.complexity > 0 
            ? ` | Complexity: ${node.complexity}` 
            : node.lineCount > 0 ? ` | Lines: ${node.lineCount}` : "";
          return `
            <div style="
              background: rgba(15, 15, 20, 0.85);
              border: 1px solid rgba(255, 255, 255, 0.1);
              padding: 10px 12px;
              border-radius: 8px;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
              font-family: system-ui, -apple-system, sans-serif;
              color: #f4f4f5;
            ">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${node.name}</div>
              <div style="font-size: 11px; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">
                ${typeLabel}${info}
              </div>
              <div style="font-size: 11px; color: rgba(255, 255, 255, 0.4); margin-top: 4px; font-family: monospace;">${node.filePath}</div>
            </div>
          `;
        }}
        linkColor={(link: any) => link.color}
        linkWidth={(link: any) => (link.label === "inside" ? 0.5 : 1.5)}
        linkDirectionalParticles={(link: any) => (link.label === "inside" ? 0 : 2)}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.008}
        linkDirectionalParticleColor={(link: any) => link.color}
        showNavInfo={false}
      />

      {/* Floating 3D Controls */}
      <Box
        sx={{
          position: "absolute",
          bottom: 24,
          left: 24,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Tooltip title="Reset Camera Focus">
          <IconButton
            onClick={resetCamera}
            sx={{
              color: "text.primary",
              bgcolor: "rgba(10, 10, 12, 0.75)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 8px 32px 0 rgba(0,0,0,0.3)",
              p: 1,
              "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
            }}
          >
            <ResetIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Navigation Guide Overlay */}
      <Box
        sx={{
          position: "absolute",
          bottom: 24,
          right: 24,
          zIndex: 1000,
          bgcolor: "rgba(10, 10, 12, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          backdropFilter: "blur(12px)",
          borderRadius: 2,
          px: 2,
          py: 1,
          pointerEvents: "none",
        }}
      >
        <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6875rem", display: "flex", flexDirection: "column", gap: 0.25 }}>
          <span>🖱️ Left click: Select Node</span>
          <span>🖱️ Double click: Focus camera</span>
          <span>🖱️ Left drag: Orbit scene</span>
          <span>🖱️ Middle drag / Scroll: Zoom</span>
          <span>🖱️ Right drag: Pan scene</span>
        </Typography>
      </Box>
    </Box>
  );
}
