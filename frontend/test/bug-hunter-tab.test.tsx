// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BugHunterTab from '../src/app/components/BugHunterTab';
import { useAtlasStore } from '../src/app/store/atlas-store';
import type { AtlasNode } from '../src/app/types/nodes';

afterEach(cleanup);

const node = (id: string, label: string): AtlasNode => ({
  id,
  type: 'file',
  position: { x: 0, y: 0 },
  data: {
    label,
    filePath: `src/${label}`,
    metadata: { lineCount: 1, exportCount: 0, maxComplexity: 1 },
    analysis: { isGodObject: false, isDeadCode: false, isEntryPoint: false },
  },
});

describe('BugHunterTab', () => {
  it('lists suspect files for a bug description', () => {
    useAtlasStore.setState({ nodes: [node('f1', 'invoice-mailer.ts'), node('f2', 'router.ts')], edges: [] });
    render(<BugHunterTab onGoToGraph={() => {}} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Invoice mailer sends duplicate emails' } });
    fireEvent.click(screen.getByRole('button', { name: /hunt|search|find|analy/i }));

    expect(screen.getByText('src/invoice-mailer.ts')).toBeTruthy();
    expect(screen.getByText(/Matched keywords: invoice, mailer/)).toBeTruthy();
    expect(screen.queryByText('src/router.ts')).toBeNull();
  });
});
