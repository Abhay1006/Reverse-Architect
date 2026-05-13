import React, { useMemo } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Chip, Paper } from '@mui/material';
import { Description } from '@mui/icons-material';
import { useAtlasStore } from '../store/atlas-store';

export default function FilesTab() {
  const nodes = useAtlasStore((state) => state.nodes);
  
  // Get files and sort by maxComplexity and exportCount (a basic importance metric)
  const files = useMemo(() => {
    return nodes
      .filter(n => n.type === 'file')
      .sort((a, b) => {
        const scoreA = (a.data?.metadata?.maxComplexity || 0) + (a.data?.metadata?.exportCount || 0);
        const scoreB = (b.data?.metadata?.maxComplexity || 0) + (b.data?.metadata?.exportCount || 0);
        return scoreB - scoreA;
      });
  }, [nodes]);

  return (
    <Box sx={{ p: 4, height: '100%', overflowY: 'auto', bgcolor: 'background.default' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Important Files</Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
        Files ranked by complexity and number of exports/symbols.
      </Typography>

      <Paper sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
        <List>
          {files.map((f, i) => (
            <ListItem key={f.id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography color="text.secondary">#{i + 1}</Typography>
                <Description sx={{ color: 'text.secondary' }} />
                <ListItemText 
                  primary={f.data.filePath as string} 
                  secondary={`${f.data.metadata?.lineCount || 0} lines`}
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {f.data.metadata?.maxComplexity ? (
                  <Chip size="small" label={`Complexity: ${f.data.metadata.maxComplexity}`} color={(f.data.metadata.maxComplexity as number) > 10 ? 'error' : 'default'} />
                ) : null}
                <Chip size="small" label={`${f.data.metadata?.exportCount || 0} Symbols`} variant="outlined" />
              </Box>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
