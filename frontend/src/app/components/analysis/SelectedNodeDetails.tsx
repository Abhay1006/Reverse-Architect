"use client";

import React, { useMemo } from "react";
import { Box, Typography, IconButton, Chip, ListItemButton } from "@mui/material";
import { FilterCenterFocus as FocusIcon } from "@mui/icons-material";
import { useAtlasStore } from "../../store/atlas-store";

/** Details, neighbour counts and incoming references for the selected node. */
export default function SelectedNodeDetails() {
  const nodes = useAtlasStore((s) => s.nodes);
  const edges = useAtlasStore((s) => s.edges);
  const panToNode = useAtlasStore((s) => s.panToNode);
  const selectedNodeId = useAtlasStore((s) => s.selectedNodeId);
  const setFocusedNode = useAtlasStore((s) => s.setFocusedNode);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId],
  );

  // Neighbor counts for selected node
  const neighborCounts = useMemo(() => {
    if (!selectedNodeId) return { in: 0, out: 0 };
    let incoming = 0;
    let outgoing = 0;
    edges.forEach((e) => {
      if (e.source === selectedNodeId) outgoing++;
      if (e.target === selectedNodeId) incoming++;
    });
    return { in: incoming, out: outgoing };
  }, [edges, selectedNodeId]);

  if (!selectedNode) return null;

  return (
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
        {selectedNode.data?.metadata?.lineCount ? (
          <Box>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block" }}>Lines</Typography>
            <Typography sx={{ fontWeight: 700 }}>{selectedNode.data.metadata.lineCount}</Typography>
          </Box>
        ) : null}
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
                        label={(e.data?.relation as string | undefined) || e.label || "ref"} 
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
  );
}
