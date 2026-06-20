import type { Node, Edge } from "@xyflow/react";

export function exportToMermaid(nodes: Node[], edges: Edge[]): string {
  let mermaid = "flowchart TD\n";

  const sanitizeId = (id: string): string => {
    return id.replace(/[^a-zA-Z0-9]/g, "_");
  };

  const getShape = (node: Node): string => {
    const label = (node.data?.label as string) || node.id;
    if (node.type === "class") return `["🔷 ${label}"]`;
    if (node.type === "interface") return `(["🔶 ${label}"])`;
    if (node.type === "function") return `{"⚡ ${label}"}`;
    if (node.type === "database") return `[("🗄️ ${label}")]`;
    return `["📁 ${label}"]`;
  };

  // Group nodes by parentId
  const topLevelNodes = nodes.filter(n => !n.parentId);
  const childrenMap = new Map<string, Node[]>();
  nodes.forEach(n => {
    if (n.parentId) {
      if (!childrenMap.has(n.parentId)) {
        childrenMap.set(n.parentId, []);
      }
      childrenMap.get(n.parentId)!.push(n);
    }
  });

  // Write top-level nodes and their subgraphs
  for (const node of topLevelNodes) {
    const children = childrenMap.get(node.id) || [];
    if (children.length > 0) {
      mermaid += `  subgraph ${sanitizeId(node.id)} ["📁 ${(node.data?.label as string) || node.id}"]\n`;
      for (const child of children) {
        mermaid += `    ${sanitizeId(child.id)}${getShape(child)}\n`;
      }
      mermaid += `  end\n`;
    } else {
      mermaid += `  ${sanitizeId(node.id)}${getShape(node)}\n`;
    }
  }

  // Write edges
  for (const edge of edges) {
    const sourceId = sanitizeId(edge.source);
    const targetId = sanitizeId(edge.target);
    const label = (edge.label as string) || "";
    
    let arrow = "-->";
    if (label === "extends") {
      arrow = "== extends ==>";
    } else if (label === "implements") {
      arrow = "-. implements .->";
    } else if (label === "calls") {
      arrow = "-->|calls|";
    } else if (label === "imports") {
      arrow = "-->|imports|";
    } else if (label) {
      arrow = `-->|${label}|`;
    }

    mermaid += `  ${sourceId} ${arrow} ${targetId}\n`;
  }

  return mermaid;
}

export function exportToJSON(nodes: Node[], edges: Edge[], analysis: unknown): string {
  return JSON.stringify({ nodes, edges, analysis }, null, 2);
}
