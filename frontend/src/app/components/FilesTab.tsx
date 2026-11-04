import React, { useMemo } from 'react';
import { Box, Typography, List, ListItemButton, Chip, Paper, IconButton, Tooltip } from '@mui/material';
import { Description, Code as CodeIcon, Flag as EntryIcon } from '@mui/icons-material';
import { useAtlasStore } from '../store/atlas-store';

export default function FilesTab() {
  const nodes = useAtlasStore((state) => state.nodes);
  const revealInGraph = useAtlasStore((state) => state.revealInGraph);
  const setCodePeekFile = useAtlasStore((state) => state.setCodePeekFile);
  const canPeek = useAtlasStore((state) => Boolean(state.activeRepoId));

  // The backend's importance score combines centrality and complexity; fall
  // back to complexity + exports for responses that predate it.
  const files = useMemo(() => {
    const score = (n: (typeof nodes)[number]) =>
      n.data?.metadata?.importanceScore ??
      (n.data?.metadata?.maxComplexity || 0) + (n.data?.metadata?.exportCount || 0);
    return nodes.filter((n) => n.type === 'file').sort((a, b) => score(b) - score(a));
  }, [nodes]);

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 1280, mx: 'auto', p: { xs: 2, md: 4 } }}>
        <Typography component="h1" sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Important files
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mt: 0.5, mb: 3 }}>
          Ranked by how central and complex each file is. Click a file to see it in the graph.
        </Typography>

        <Paper elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', backgroundImage: 'none', overflow: 'hidden' }}>
          <List disablePadding>
            {files.map((f, i) => {
              const complexity = f.data.metadata?.maxComplexity ?? 0;
              return (
                <ListItemButton
                  key={f.id}
                  onClick={() => revealInGraph([f.id])}
                  sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 1.5, py: 1.25, '&:last-of-type': { borderBottom: 'none' } }}
                >
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', width: 28, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {i + 1}
                  </Typography>
                  <Description sx={{ color: 'text.secondary', fontSize: 18, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 0.75, wordBreak: 'break-all' }}>
                      {f.data.filePath}
                      {f.data.analysis?.isEntryPoint && (
                        <Tooltip title="Entry point">
                          <EntryIcon sx={{ fontSize: 14, color: '#a5b4fc' }} />
                        </Tooltip>
                      )}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {f.data.metadata?.lineCount || 0} lines · {f.data.metadata?.exportCount || 0} symbols
                    </Typography>
                  </Box>
                  {complexity > 0 && (
                    <Chip
                      size="small"
                      label={`complexity ${complexity}`}
                      color={complexity > 10 ? 'warning' : 'default'}
                      variant={complexity > 10 ? 'filled' : 'outlined'}
                      sx={{ height: 22, fontSize: '0.6875rem', display: { xs: 'none', sm: 'inline-flex' } }}
                    />
                  )}
                  {canPeek && (
                    <Tooltip title="View code">
                      <IconButton
                        size="small"
                        aria-label={`View code of ${f.data.filePath}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCodePeekFile({ filePath: f.data.filePath, label: f.data.label });
                        }}
                        sx={{ color: 'text.secondary' }}
                      >
                        <CodeIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </Paper>
      </Box>
    </Box>
  );
}
