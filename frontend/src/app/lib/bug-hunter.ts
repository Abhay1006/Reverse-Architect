import type { Edge } from '@xyflow/react';
import type { AtlasNode } from '../types/nodes';

// ============================================================
//  Bug Hunter scoring
//  Ranks files by how well they match a bug description:
//   1. keyword matching over each node's name, path and members;
//   2. one hop of spreading activation — a node connected to a
//      strong match inherits 40% of that match's score.
//  No LLM, no index: it is a fast first guess, not a diagnosis.
// ============================================================

export interface Suspect {
  node: AtlasNode;
  score: number;
  reason: string;
}

const STOPWORDS = new Set(["the", "and", "when", "bug", "fix", "issue", "error", "fails", "this", "that", "with", "from", "have", "been", "there"]);

/** Returns the top `limit` files for a bug description, best first. */
export function rankSuspects(issueText: string, nodes: AtlasNode[], edges: Edge[], limit = 5): Suspect[] {
  // 1. Tokenize & Clean
  const rawWords = issueText.match(/[a-zA-Z0-9_]{3,}/g) || [];
  const terms = Array.from(new Set(rawWords.map(w => w.toLowerCase()).filter(w => !STOPWORDS.has(w))));

  if (terms.length === 0) return [];

  // 2. Keyword scoring
  const scores = new Map<string, number>();
  const reasons = new Map<string, string>();

  nodes.forEach(n => {
    let score = 0;
    const matchedTerms: string[] = [];

    const label = (n.data?.label as string) || "";
    const path = (n.data?.filePath as string) || "";
    const meta = n.data?.metadata;
    
    const properties = meta?.properties?.join(" ") || "";
    const methods = meta?.methods?.join(" ") || "";
    const entities = meta?.entities?.map((e) => e.name).join(" ") || "";

    const bigString = `${label} ${path} ${properties} ${methods} ${entities}`.toLowerCase();

    terms.forEach(term => {
      let termScore = 0;
      
      // Exact matches in filename are high value
      if (label.toLowerCase().includes(term)) termScore += 10;
      if (path.toLowerCase().includes(term)) termScore += 5;
      
      // Occurrences in content (functions, variables)
      const occurrences = bigString.split(term).length - 1;
      termScore += occurrences * 2;

      if (termScore > 0) {
        score += termScore;
        matchedTerms.push(term);
      }
    });

    if (score > 0) {
      scores.set(n.id, score);
      reasons.set(n.id, `Matched keywords: ${matchedTerms.join(", ")}`);
    }
  });

  // 3. Spreading Activation (Architectural Context)
  // If a node is connected to a highly suspected node, bump its score!
  const finalScores = new Map(scores);
  edges.forEach(e => {
    const s1 = scores.get(e.source) || 0;
    const s2 = scores.get(e.target) || 0;

    if (s1 > 0) {
      finalScores.set(e.target, (finalScores.get(e.target) || 0) + s1 * 0.4);
      if (!reasons.has(e.target)) reasons.set(e.target, `Architecturally coupled to suspected node`);
    }
    if (s2 > 0) {
      finalScores.set(e.source, (finalScores.get(e.source) || 0) + s2 * 0.4);
      if (!reasons.has(e.source)) reasons.set(e.source, `Architecturally coupled to suspected node`);
    }
  });

  // 4. Sort & Format
  return Array.from(finalScores.entries())
    .map(([id, score]) => ({
      node: nodes.find(n => n.id === id)!,
      score,
      reason: reasons.get(id) || ""
    }))
    .filter(r => r.node && r.node.type === 'file') // Only suggest files
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
