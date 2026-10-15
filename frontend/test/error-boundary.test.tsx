// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ErrorBoundary } from '../src/app/components/ErrorBoundary';

afterEach(cleanup);

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('graph layout exploded');
  return <p>graph ok</p>;
}

function Harness() {
  const [explode, setExplode] = useState(true);
  return (
    <>
      <button onClick={() => setExplode(false)}>defuse</button>
      <ErrorBoundary>
        <Bomb explode={explode} />
      </ErrorBoundary>
    </>
  );
}

describe('ErrorBoundary', () => {
  it('shows the error instead of a blank screen, and recovers on retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Harness />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('graph layout exploded')).toBeTruthy();

    fireEvent.click(screen.getByText('defuse'));
    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByText('graph ok')).toBeTruthy();
  });
});
