"use client";

import React, { useMemo, useCallback } from "react";
import {
  FolderOpen,
  Folder,
  ChevronRight,
  Zap,
  FileText,
  ListCollapse,
} from "lucide-react";
import { useAtlasStore, buildFolderTree, type FolderTreeNode } from "../store/atlas-store";

// ── Icons ─────────────────────────────────────────────────────────────

function FolderIcon({ isOpen }: { isOpen: boolean }) {
  return isOpen ? (
    <FolderOpen className="ft-icon" />
  ) : (
    <Folder className="ft-icon" />
  );
}

function FileIcon({ nodeType, isEntryPoint }: { nodeType?: string; isEntryPoint?: boolean }) {
  if (isEntryPoint) {
    return <Zap className="ft-icon" style={{ color: "var(--primary)" }} />;
  }

  const color =
    nodeType === "class"
      ? "var(--class-bg)"
      : nodeType === "interface"
        ? "var(--interface-bg)"
        : nodeType === "function"
          ? "var(--function-bg)"
          : "var(--file-bg)";

  return <FileText className="ft-icon" style={{ color }} />;
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <ChevronRight
      className={`ft-chevron ${isOpen ? "ft-chevron--open" : ""}`}
    />
  );
}

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
  const isInPath = focusPath.startsWith(node.path + "/") || focusPath === node.path;

  const handleClick = useCallback(() => {
    if (node.isFolder) {
      onToggle(node.path);
      onFocus(node.path);
    } else if (node.nodeId) {
      // For files: focus their parent dir and select the node
      const parentPath = node.path.substring(0, node.path.lastIndexOf("/"));
      onFocus(parentPath || "");
      onSelectNode(node.nodeId);
    }
  }, [node, onToggle, onFocus, onSelectNode]);

  return (
    <>
      <button
        className={`ft-node ${isActive ? "ft-node--active" : ""} ${isInPath ? "ft-node--in-path" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        title={node.path}
      >
        {node.isFolder && <ChevronIcon isOpen={isExpanded} />}
        {!node.isFolder && <span className="ft-spacer" />}

        {node.isFolder ? (
          <FolderIcon isOpen={isExpanded} />
        ) : (
          <FileIcon nodeType={node.nodeType} isEntryPoint={node.isEntryPoint} />
        )}

        <span className={`ft-label ${node.isEntryPoint ? "font-bold text-[var(--primary)]" : ""}`}>
          {node.name}
        </span>

        {node.isFolder && node.children.length > 0 && (
          <span className="ft-badge">{node.children.length}</span>
        )}
      </button>

      {node.isFolder && isExpanded && (
        <div className="ft-children">
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
        </div>
      )}
    </>
  );
}

// ── Main FolderTree Component ─────────────────────────────────────────

export default function FolderTree() {
  const { nodes, focusPath, expandedFolders, setFocusPath, toggleFolder, setSelectedNode } =
    useAtlasStore();

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
      <div className="ft-sidebar">
        <div className="ft-header">
          <span className="ft-header-title">Explorer</span>
        </div>
        <div className="ft-empty">
          <p>No project loaded.</p>
          <p className="ft-empty-sub">Analyze a repository to see its structure.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ft-sidebar">
      <div className="ft-header">
        <span className="ft-header-title">Explorer</span>
        <button
          className="ft-header-btn"
          title="Collapse all"
          onClick={() => {
            // Reset to root
            setFocusPath("");
            // We need to clear expanded folders - use toggleFolder for each
            expandedFolders.forEach((path) => toggleFolder(path));
          }}
        >
          <ListCollapse className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="ft-tree">
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
      </div>
    </div>
  );
}
