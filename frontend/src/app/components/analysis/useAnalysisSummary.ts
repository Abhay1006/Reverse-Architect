import { useCallback, useMemo } from "react";
import { useAtlasStore } from "../../store/atlas-store";

export interface IssueItem {
  id: string;
  label: string;
  sublabel?: string;
}

/** Counts, top files and issue lists the analysis sidebar displays. */
export function useAnalysisSummary() {
  const nodes = useAtlasStore((s) => s.nodes);
  const edges = useAtlasStore((s) => s.edges);
  const analysis = useAtlasStore((s) => s.analysisResults);
  const godObjectDetails = useAtlasStore((s) => s.godObjectDetails);
  const deadCodeDetails = useAtlasStore((s) => s.deadCodeDetails);

  const stats = useMemo(() => {
    const files = nodes.filter((n) => n.type === "file").length;
    const classes = nodes.filter((n) => n.type === "class").length;
    const interfaces = nodes.filter((n) => n.type === "interface").length;
    const functions = nodes.filter((n) => n.type === "function").length;
    return {
      files,
      classes,
      interfaces,
      functions,
      total: nodes.length,
      edges: edges.length,
    };
  }, [nodes, edges]);

  const topFiles = useMemo(() => {
    return nodes
      .filter((n) => n.type === "file")
      .map((n) => ({
        id: n.id,
        label: n.data.label,
        score: n.data.metadata?.importanceScore ?? 0,
        path: n.data.filePath,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [nodes]);

  // Resolve node IDs to labels for display
  const nodeLabel = useCallback(
    (id: string) => nodes.find((node) => node.id === id)?.data?.label ?? id,
    [nodes],
  );

  // Build god object display items with connection counts
  const godObjectItems = useMemo((): IssueItem[] => {
    if (godObjectDetails && godObjectDetails.length > 0) {
      return godObjectDetails.map((d) => ({
        id: d.nodeId,
        label: d.label,
        sublabel: `${d.totalDegree} connections (${d.inDegree} in, ${d.outDegree} out)`,
      }));
    }
    return (analysis?.godObjects ?? []).map((id) => ({
      id,
      label: nodeLabel(id),
    }));
  }, [godObjectDetails, analysis, nodeLabel]);

  const deadCodeItems = useMemo((): IssueItem[] => {
    if (deadCodeDetails && deadCodeDetails.length > 0) {
      return deadCodeDetails.map((d) => ({
        id: d.nodeId,
        label: d.label,
        sublabel: `[${d.nodeType}] ${d.filePath}`,
      }));
    }
    return (analysis?.deadCode ?? []).map((id) => ({
      id,
      label: nodeLabel(id),
    }));
  }, [deadCodeDetails, analysis, nodeLabel]);

  // Edge `type` is the React Flow renderer ("smoothstep"); the architectural
  // relationship is `data.relation`. Counting by label missed every
  // entity-level extends/implements edge, which carries no label.
  const edgeCounts = useMemo(() => {
    const counts = { import: 0, calls: 0, extends: 0, implements: 0 };
    for (const e of edges) {
      const relation = (e.data?.relation as keyof typeof counts | undefined) ?? "import";
      if (relation in counts) counts[relation]++;
    }
    return counts;
  }, [edges]);

  const godObjectCount = godObjectItems.length;
  const deadCodeCount = deadCodeItems.length;
  const cycleCount = analysis?.cycles?.length ?? 0;
  const patternCount = analysis?.patterns?.length ?? 0;
  const totalIssues = godObjectCount + deadCodeCount + cycleCount + patternCount;

  return {
    analysis,
    stats,
    topFiles,
    nodeLabel,
    godObjectItems,
    deadCodeItems,
    edgeCounts,
    godObjectCount,
    deadCodeCount,
    cycleCount,
    patternCount,
    totalIssues,
  };
}
