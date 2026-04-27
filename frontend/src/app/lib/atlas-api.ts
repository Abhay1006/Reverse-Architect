// ============================================================
//  Atlas-TS — Frontend API Client
//  Communicates with the backend (via Next.js proxy routes)
//  to trigger project analysis and retrieve graph data.
// ============================================================

import type { AnalysisResult } from '../../../../shared/types';
import type { Node, Edge } from '@xyflow/react';
import type { AtlasNode } from '../types/nodes';

// ---------------------------------------------------------------------------
//  Types — mirrors backend serialize.ts ReactFlowGraph
// ---------------------------------------------------------------------------

export interface ReactFlowNodeData {
  label: string;
  filePath: string;
  nodeType: 'file' | 'class' | 'interface' | 'function';
  metadata: {
    properties?: string[];
    methods?: string[];
    lineCount?: number;
    exportCount?: number;
    width?: number;
    height?: number;
  };
  analysis?: {
    isGodObject?: boolean;
    isDeadCode?: boolean;
    isEntryPoint?: boolean;
  };
  width: number;
  height: number;
  [key: string]: unknown;
}

export interface GodObjectDetail {
  nodeId: string;
  label: string;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}

export interface DeadCodeDetail {
  nodeId: string;
  label: string;
  nodeType: string;
  filePath: string;
  outDegree: number;
}

export interface EntryPoint {
  entryFile: string;
  framework: 'node' | 'nextjs' | 'vite' | 'express' | 'unknown';
  packageName?: string;
}

export interface ReactFlowGraph {
  nodes: {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: ReactFlowNodeData;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    type?: string;
    label?: string;
    animated?: boolean;
  }[];
  analysis: AnalysisResult;
  godObjectDetails?: GodObjectDetail[];
  deadCodeDetails?: DeadCodeDetail[];
  entryPoint?: EntryPoint;
}

// ---------------------------------------------------------------------------
//  Configuration
// ---------------------------------------------------------------------------

/** Base URL for the direct backend API (used when NOT proxying via Next.js) */
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

/** Whether to route requests through the Next.js API proxy */
const USE_PROXY = true;

function apiBase(): string {
  return USE_PROXY ? '/api/analyze' : `${BACKEND_URL}/api/analyze`;
}

// ---------------------------------------------------------------------------
//  Error Handling
// ---------------------------------------------------------------------------

export class AtlasApiError extends Error {
  public readonly status: number;
  public readonly details?: string;

  constructor(message: string, status: number, details?: string) {
    super(message);
    this.name = 'AtlasApiError';
    this.status = status;
    this.details = details;
  }
}

async function handleResponse(res: Response): Promise<ReactFlowGraph> {
  if (!res.ok) {
    let details: string | undefined;
    try {
      const body = await res.json();
      details = body.error ?? body.message ?? JSON.stringify(body);
    } catch {
      details = await res.text().catch(() => undefined);
    }
    throw new AtlasApiError(
      `Analysis failed (${res.status})`,
      res.status,
      details,
    );
  }

  const data: ReactFlowGraph = await res.json();
  return data;
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

/**
 * Upload a .zip file for analysis.
 * Sends the file as multipart/form-data to POST /api/analyze/upload.
 */
export async function analyzeUpload(file: File): Promise<ReactFlowGraph> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${apiBase()}/upload`, {
    method: 'POST',
    body: formData,
    // NOTE: Do NOT set Content-Type — the browser sets it automatically
    // with the correct multipart boundary.
  });

  return handleResponse(res);
}

/**
 * Analyze a public GitHub repository by URL.
 * Sends a JSON body to POST /api/analyze/github.
 */
export async function analyzeGithub(url: string): Promise<ReactFlowGraph> {
  const res = await fetch(`${apiBase()}/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  return handleResponse(res);
}

// ---------------------------------------------------------------------------
//  Store Adapter
//  Converts the API response into the shape expected by useAtlasStore.setGraph
// ---------------------------------------------------------------------------

export function toStoreGraph(graph: ReactFlowGraph): {
  nodes: AtlasNode[];
  edges: Edge[];
  analysis: AnalysisResult;
  godObjectDetails: GodObjectDetail[];
  deadCodeDetails: DeadCodeDetail[];
  entryPoint?: EntryPoint;
} {
  const nodes: AtlasNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: n.type as any,
    position: n.position,
    data: {
      label: n.data.label,
      filePath: n.data.filePath,
      metadata: n.data.metadata,
      analysis: n.data.analysis,
    },
  }));

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type,
    label: e.label,
    animated: e.animated,
  }));

  return {
    nodes,
    edges,
    analysis: graph.analysis,
    godObjectDetails: graph.godObjectDetails ?? [],
    deadCodeDetails: graph.deadCodeDetails ?? [],
    entryPoint: graph.entryPoint,
  };
}
