# Atlas — frontend

The Next.js client for Atlas. See the [root README](../README.md) for setup, configuration and the API reference. Install and run everything from the repository root.

## Layout

| Path | What lives there |
|---|---|
| `src/app/page.tsx` | The single-page app shell |
| `src/app/components/` | UI. Larger features are split into folders (`ai/`, `analysis/`, `canvas/`, `nodes/`) of hooks plus presentational components |
| `src/app/store/atlas-store.ts` | Zustand store: graph, selection, filters |
| `src/app/hooks/useAnalysis.ts` | Analysis mutations, which own the progress stream and the store update |
| `src/app/lib/atlas-api.ts` | Browser-side API client |
| `src/app/lib/backend-proxy.ts` | Server-only helpers shared by the proxy routes |
| `src/app/api/**/route.ts` | Proxy routes that forward to the backend, so the backend can stay bound to loopback |

## Conventions

- **Server data goes through React Query** (`useQuery` / `useMutation`). Don't fetch inside `useEffect` and copy the result into state.
- **Styling uses MUI** (`sx` props) with the color tokens in `globals.css`. Use MUI components for new UI rather than adding another component or form library.
- **Proxy routes** read the backend address from `BACKEND_URL` via `lib/backend-proxy.ts`. They relay the backend's status and JSON body unchanged, so its `{ error, details }` reaches the UI.

## Scripts

Run from the repository root:

```bash
npm run dev -w frontend        # next dev
npm run lint -w frontend       # eslint
npm run typecheck -w frontend  # tsc --noEmit
npm test -w frontend           # vitest
```
