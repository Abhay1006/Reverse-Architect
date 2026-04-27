"use client";

import React, { useMemo } from "react";
import { useAtlasStore } from "../store/atlas-store";

interface AnalysisSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ── tiny SVG icons (inline to avoid deps) ────────────────────────────── */

const IconFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconClass = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <path d="M8 7h8M8 12h8M8 17h4" />
  </svg>
);

const IconInterface = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8M12 8v8" />
  </svg>
);

const IconFunction = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3c-1.1 0-2 .9-2 2v4H5" />
    <path d="M10 3c1.1 0 2 .9 2 2v4h3" />
    <path d="M6 14c-1.1 0-2 .9-2 2s.9 2 2 2" />
    <path d="M14 14c1.1 0 2 .9 2 2s-.9 2-2 2" />
    <path d="M4 9h6M14 9h6" />
  </svg>
);

const IconWarning = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconCycle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconGhost = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2 3 3-3 3 3 2-3 3 3V10a8 8 0 0 0-8-8z" />
  </svg>
);

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconEdge = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const IconPattern = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

/* ── stat card ────────────────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ "--stat-color": color } as React.CSSProperties} className="analysis-stat-card">
      <div className="analysis-stat-icon" style={{ color }}>
        {icon}
      </div>
      <div className="analysis-stat-text">
        <span className="analysis-stat-value">{value}</span>
        <span className="analysis-stat-label">{label}</span>
      </div>
    </div>
  );
}

/* ── issue row ────────────────────────────────────────────────────────── */

function IssueRow({
  icon,
  label,
  count,
  color,
  items,
  onItemClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  items: { id: string; label: string; sublabel?: string }[];
  onItemClick?: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="analysis-issue-row">
      <button
        className="analysis-issue-header"
        onClick={() => count > 0 && setExpanded(!expanded)}
        style={{ cursor: count > 0 ? "pointer" : "default" }}
      >
        <div className="analysis-issue-left">
          <span style={{ color }}>{icon}</span>
          <span className="analysis-issue-label">{label}</span>
        </div>
        <span
          className="analysis-issue-badge"
          style={{
            background: count > 0 ? color : "rgba(255,255,255,0.05)",
            color: count > 0 ? "#fff" : "rgba(255,255,255,0.3)",
          }}
        >
          {count}
        </span>
      </button>
      {expanded && items.length > 0 && (
        <ul className="analysis-issue-list">
          {items.map((item, idx) => (
            <li 
              key={`${item.id}-${idx}`} 
              className="analysis-issue-item group flex justify-between items-center cursor-pointer hover:bg-white/5 px-2 py-1.5 rounded transition-colors"
              onClick={() => onItemClick?.(item.id)}
            >
              <div className="flex flex-col">
                <span className="text-sm text-white/80 group-hover:text-white transition-colors">{item.label}</span>
                {item.sublabel && <span className="text-[10px] text-white/30">{item.sublabel}</span>}
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white/40 uppercase font-bold tracking-tighter">View</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── main sidebar ─────────────────────────────────────────────────────── */

export default function AnalysisSidebar({ isOpen, onClose }: AnalysisSidebarProps) {
  const nodes = useAtlasStore((s) => s.nodes);
  const edges = useAtlasStore((s) => s.edges);
  const analysis = useAtlasStore((s) => s.analysisResults);
  const godObjectDetails = useAtlasStore((s) => s.godObjectDetails);
  const deadCodeDetails = useAtlasStore((s) => s.deadCodeDetails);
  const panToNode = useAtlasStore((s) => s.panToNode);

  const stats = useMemo(() => {
    const files = nodes.filter((n) => n.type === "file").length;
    const classes = nodes.filter((n) => n.type === "class").length;
    const interfaces = nodes.filter((n) => n.type === "interface").length;
    const functions = nodes.filter((n) => n.type === "function").length;
    return { files, classes, interfaces, functions, total: nodes.length, edges: edges.length };
  }, [nodes, edges]);

  // Resolve node IDs to labels for display
  const nodeLabel = (id: string) => {
    const n = nodes.find((node) => node.id === id);
    return (n?.data as any)?.label ?? id;
  };

  // Build god object display items with connection counts
  const godObjectItems = useMemo(() => {
    if (godObjectDetails && godObjectDetails.length > 0) {
      return godObjectDetails.map(d => ({
        id: d.nodeId,
        label: d.label,
        sublabel: `${d.totalDegree} connections (${d.inDegree} in, ${d.outDegree} out)`
      }));
    }
    return (analysis?.godObjects ?? []).map(id => ({
      id,
      label: nodeLabel(id)
    }));
  }, [godObjectDetails, analysis, nodes]);

  const deadCodeItems = useMemo(() => {
    if (deadCodeDetails && deadCodeDetails.length > 0) {
      return deadCodeDetails.map(d => ({
        id: d.nodeId,
        label: d.label,
        sublabel: `[${d.nodeType}] ${d.filePath}`
      }));
    }
    return (analysis?.deadCode ?? []).map(id => ({
      id,
      label: nodeLabel(id)
    }));
  }, [deadCodeDetails, analysis, nodes]);

  const godObjectCount = godObjectItems.length;
  const deadCodeCount = deadCodeItems.length;
  const cycleCount = analysis?.cycles?.length ?? 0;
  const patternCount = analysis?.patterns?.length ?? 0;

  const totalIssues = godObjectCount + deadCodeCount + cycleCount + patternCount;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="analysis-backdrop" onClick={onClose} />
      )}

      {/* Panel */}
      <aside
        className={`analysis-sidebar ${isOpen ? "analysis-sidebar--open" : ""}`}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <div className="analysis-header">
          <div>
            <h2 className="analysis-title">Analysis</h2>
            <p className="analysis-subtitle">Architecture overview</p>
          </div>
          <button className="analysis-close" onClick={onClose}>
            <IconX />
          </button>
        </div>

        {/* ── Project Summary ──────────────────────────────── */}
        <div className="analysis-section">
          <h3 className="analysis-section-title">Project Summary</h3>
          <div className="analysis-stat-grid">
            <StatCard icon={<IconFile />} label="Files" value={stats.files} color="var(--file-bg)" />
            <StatCard icon={<IconClass />} label="Classes" value={stats.classes} color="var(--class-bg)" />
            <StatCard icon={<IconInterface />} label="Interfaces" value={stats.interfaces} color="var(--interface-bg)" />
            <StatCard icon={<IconFunction />} label="Functions" value={stats.functions} color="var(--function-bg)" />
          </div>

          {/* Totals bar */}
          <div className="analysis-totals">
            <div className="analysis-totals-item">
              <span className="analysis-totals-value">{stats.total}</span>
              <span className="analysis-totals-label">Nodes</span>
            </div>
            <div className="analysis-totals-divider" />
            <div className="analysis-totals-item">
              <span className="analysis-totals-value">{stats.edges}</span>
              <span className="analysis-totals-label">Edges</span>
            </div>
            <div className="analysis-totals-divider" />
            <div className="analysis-totals-item">
              <span className="analysis-totals-value">{patternCount}</span>
              <span className="analysis-totals-label">Patterns</span>
            </div>
          </div>
        </div>

        {/* ── Issues ───────────────────────────────────────── */}
        <div className="analysis-section">
          <div className="analysis-issues-header">
            <h3 className="analysis-section-title">Issues</h3>
            {totalIssues > 0 ? (
              <span className="analysis-issues-total">{totalIssues} found</span>
            ) : (
              <span className="analysis-issues-clean">✓ Clean</span>
            )}
          </div>

          <div className="analysis-issue-list-container">
            <IssueRow
              icon={<IconWarning />}
              label="God Objects"
              count={godObjectCount}
              color="var(--god-object)"
              items={godObjectItems}
              onItemClick={panToNode}
            />
            <IssueRow
              icon={<IconGhost />}
              label="Dead Code"
              count={deadCodeCount}
              color="var(--dead-code)"
              items={deadCodeItems}
              onItemClick={panToNode}
            />
            <IssueRow
              icon={<IconCycle />}
              label="Circular Deps"
              count={cycleCount}
              color="#f59e0b"
              items={
                (analysis?.cycles ?? []).map((cycle, i) => ({
                  id: cycle[0], // Pan to first node in cycle
                  label: `Cycle ${i + 1}`,
                  sublabel: cycle.map(nodeLabel).join(" → ")
                }))
              }
              onItemClick={panToNode}
            />
            <IssueRow
              icon={<IconPattern />}
              label="Patterns"
              count={patternCount}
              color="#8b5cf6"
              items={
                (analysis?.patterns ?? []).map(p => ({
                  id: p.nodeId,
                  label: nodeLabel(p.nodeId),
                  sublabel: `[${p.pattern.toUpperCase()}] ${p.confidence} confidence`
                }))
              }
              onItemClick={panToNode}
            />
          </div>
        </div>

        {/* ── Edge Breakdown ───────────────────────────────── */}
        <div className="analysis-section">
          <h3 className="analysis-section-title">Connections</h3>
          <div className="analysis-edge-breakdown">
            <EdgeStat
              label="Imports"
              count={edges.filter((e) => e.label === "uses" || e.type === "import" || (!e.label && !e.type)).length}
              color="var(--primary)"
            />
            <EdgeStat
              label="Extends"
              count={edges.filter((e) => e.label === "extends" || e.type === "extends").length}
              color="var(--secondary)"
            />
            <EdgeStat
              label="Implements"
              count={edges.filter((e) => e.label === "implements" || e.type === "implements").length}
              color="var(--accent)"
            />
          </div>
        </div>
      </aside>
    </>
  );
}

/* ── edge stat mini component ─────────────────────────────────────────── */

function EdgeStat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="analysis-edge-row">
      <div className="analysis-edge-left">
        <span className="analysis-edge-dot" style={{ background: color }} />
        <span className="analysis-edge-label">{label}</span>
      </div>
      <span className="analysis-edge-count">{count}</span>
    </div>
  );
}
