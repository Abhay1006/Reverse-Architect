import type { GraphNode } from './types/node';

export async function route(path: string): Promise<string> {
  // Loaded lazily: there is no static import of the page module.
  const page = await import('./pages/about');
  const root: GraphNode = { id: path, edges: [] };
  return page.render(root.id);
}
