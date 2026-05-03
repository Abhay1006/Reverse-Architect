"use client";

import React, { useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Collapse,
} from "@mui/material";
import {
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon,
  ChevronRight as ChevronRightIcon,
  Bolt as EntryPointIcon,
  InsertDriveFile as FileTextIcon,
  UnfoldLess as CollapseAllIcon,
} from "@mui/icons-material";
import {
  useAtlasStore,
  buildFolderTree,
  type FolderTreeNode,
} from "../store/atlas-store";

// ── Tree Node Component ───────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  expandedFolders,
  focusPath,
  onToggle,
  onFocus,
  onSelectNode,
}: {
  node: FolderTreeNode;
  depth: number;
  expandedFolders: Set<string>;
  focusPath: string;
  onToggle: (path: string) => void;
  onFocus: (path: string) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isActive = focusPath === node.path;
  const isInPath =
    focusPath.startsWith(node.path + "/") || focusPath === node.path;

  const handleClick = useCallback(() => {
    if (node.isFolder) {
      onToggle(node.path);
      onFocus(node.path);
    } else if (node.nodeId) {
      // For files: focus their parent dir and select the node
      const parentPath = node.path.substring(
        0,
        node.path.lastIndexOf("/")
      );
      onFocus(parentPath || "");
      onSelectNode(node.nodeId);
    }
  }, [node, onToggle, onFocus, onSelectNode]);

  const getFileColor = () => {
    if (node.isEntryPoint) return "primary.main";
    switch (node.nodeType) {
      case "class":
        return "var(--class-bg)";
      case "interface":
        return "var(--interface-bg)";
      case "function":
        return "var(--function-bg)";
      default:
        return "var(--file-bg)";
    }
  };

  return (
    <>
      <ListItemButton
        onClick={handleClick}
        selected={isActive}
        sx={{
          pl: `${12 + depth * 16}px`,
          py: 0.5,
          minHeight: 30,
          gap: 0.5,
          color: isInPath
            ? "rgba(255,255,255,0.75)"
            : "rgba(255,255,255,0.6)",
          "&.Mui-selected": {
            bgcolor: "rgba(99,102,241,0.12)",
            color: "white",
            "&:hover": {
              bgcolor: "rgba(99,102,241,0.16)",
            },
          },
          "&:hover": {
            bgcolor: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.85)",
          },
          borderRadius: 0,
        }}
      >
        {/* Chevron for folders */}
        {node.isFolder ? (
          <ChevronRightIcon
            sx={{
              fontSize: 14,
              color: "rgba(255,255,255,0.25)",
              transition: "transform 0.15s ease",
              transform: isExpanded ? "rotate(90deg)" : "none",
              flexShrink: 0,
            }}
          />
        ) : (
          <Box sx={{ width: 14, flexShrink: 0 }} />
        )}

        {/* Icon */}
        <ListItemIcon sx={{ minWidth: 24 }}>
          {node.isFolder ? (
            isExpanded ? (
              <FolderOpenIcon sx={{ fontSize: 16 }} />
            ) : (
              <FolderIcon sx={{ fontSize: 16 }} />
            )
          ) : node.isEntryPoint ? (
            <EntryPointIcon sx={{ fontSize: 16, color: "primary.main" }} />
          ) : (
            <FileTextIcon
              sx={{ fontSize: 16, color: getFileColor() }}
            />
          )}
        </ListItemIcon>

        {/* Label */}
        <ListItemText
          primary={node.name}
          slotProps={{
            primary: {
              sx: {
                fontSize: "0.8125rem",
                fontWeight: node.isEntryPoint ? 700 : 400,
                color: node.isEntryPoint
                  ? "primary.main"
                  : "inherit",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            },
          }}
        />

        {/* Badge for folder children count */}
        {node.isFolder && node.children.length > 0 && (
          <Chip
            label={node.children.length}
            size="small"
            sx={{
              height: 18,
              fontSize: "0.625rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.25)",
              bgcolor: "rgba(255,255,255,0.04)",
              ml: "auto",
            }}
          />
        )}
      </ListItemButton>

      {/* Children */}
      {node.isFolder && (
        <Collapse in={isExpanded} timeout={150}>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              focusPath={focusPath}
              onToggle={onToggle}
              onFocus={onFocus}
              onSelectNode={onSelectNode}
            />
          ))}
        </Collapse>
      )}
    </>
  );
}

// ── Main FolderTree Component ─────────────────────────────────────────

export default function FolderTree() {
  const {
    nodes,
    focusPath,
    expandedFolders,
    setFocusPath,
    toggleFolder,
    setSelectedNode,
  } = useAtlasStore();

  const tree = useMemo(() => buildFolderTree(nodes), [nodes]);

  const handleFocus = useCallback(
    (path: string) => {
      setFocusPath(path);
    },
    [setFocusPath]
  );

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedNode(nodeId);
    },
    [setSelectedNode]
  );

  if (nodes.length === 0) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            pt: 1.75,
            pb: 1.25,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Explorer
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            p: 3,
            textAlign: "center",
            color: "rgba(255,255,255,0.2)",
            fontSize: "0.8125rem",
          }}
        >
          <Typography>No project loaded.</Typography>
          <Typography
            sx={{
              fontSize: "0.6875rem",
              color: "rgba(255,255,255,0.12)",
              mt: 0.5,
            }}
          >
            Analyze a repository to see its structure.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          pt: 1.75,
          pb: 1.25,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Explorer
        </Typography>
        <Tooltip title="Collapse all">
          <IconButton
            size="small"
            onClick={() => {
              // Reset to root
              setFocusPath("");
              // Clear expanded folders
              expandedFolders.forEach((path) => toggleFolder(path));
            }}
            sx={{
              color: "rgba(255,255,255,0.3)",
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.7)",
              },
            }}
          >
            <CollapseAllIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tree */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          py: 0.75,
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.06) transparent",
        }}
      >
        <List disablePadding dense>
          {tree.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={0}
              expandedFolders={expandedFolders}
              focusPath={focusPath}
              onToggle={toggleFolder}
              onFocus={handleFocus}
              onSelectNode={handleSelectNode}
            />
          ))}
        </List>
      </Box>
    </Box>
  );
}
