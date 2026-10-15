import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import { rankSuspects } from '../src/app/lib/bug-hunter';
import type { AtlasNode } from '../src/app/types/nodes';

const file = (id: string, label: string, methods: string[] = []): AtlasNode => ({
  id,
  type: 'file',
  position: { x: 0, y: 0 },
  data: {
    label,
    filePath: `src/${label}`,
    metadata: { lineCount: 1, exportCount: 0, maxComplexity: 1, methods },
    analysis: { isGodObject: false, isDeadCode: false, isEntryPoint: false },
  },
});

const nodes = [file('a', 'payment.ts', ['charge']), file('b', 'checkout.ts'), file('c', 'unrelated.ts')];
const edges: Edge[] = [{ id: 'e', source: 'b', target: 'a' }];

describe('rankSuspects', () => {
  it('ranks the best keyword match first and explains why', () => {
    const [top] = rankSuspects('Payment charge fails for EU cards', nodes, edges);
    expect(top?.node.id).toBe('a');
    expect(top?.reason).toBe('Matched keywords: payment, charge');
  });

  it('boosts files connected to a strong match', () => {
    const ranked = rankSuspects('payment', nodes, edges);
    expect(ranked.map(s => s.node.id)).toEqual(['a', 'b']);
    expect(ranked[1]?.reason).toBe('Architecturally coupled to suspected node');
  });

  it('returns nothing for stopwords or short words only', () => {
    expect(rankSuspects('the bug is in it', nodes, edges)).toEqual([]);
  });
});
