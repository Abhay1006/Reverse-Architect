"use client";

import React, { useMemo, useCallback } from "react";
import { useAtlasStore, buildFolderTree, type FolderTreeNode } from "../store/atlas-store";

// ── Icons ─────────────────────────────────────────────────────────────

function FolderIcon({ isOpen }: { isOpen: boolean }) {
  return isOpen ? (
    <svg className="ft-icon" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H4a2 2 0 00-2 2v4l1.5-6A2 2 0 015.5 7H18v-1a2 2 0 00-2-2h-5l-2-2H4a2 2 0 00-2 2v8z" />
    </svg>
  ) : (
    <svg className="ft-icon" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function FileIcon({ nodeType, isEntryPoint }: { nodeType?: string; isEntryPoint?: boolean }) {
  if (isEntryPoint) {
    return (
      <svg className="ft-icon" viewBox="0 0 20 20" fill="var(--primary)">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
      </svg>
    );
  }

  const color =
    nodeType === "class"
      ? "var(--class-bg)"
      : nodeType === "interface"
        ? "var(--interface-bg)"
        : nodeType === "function"
          ? "var(--function-bg)"
          : "var(--file-bg)";

  return (
    <svg className="ft-icon" viewBox="0 0 20 20" fill={color}>
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`ft-chevron ${isOpen ? "ft-chevron--open" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
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
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
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
