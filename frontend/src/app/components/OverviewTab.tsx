import React from 'react';
import { Box, Typography, Paper, Grid, Chip, Button } from '@mui/material';
import { Architecture, Warning, Functions, Description } from '@mui/icons-material';
import { useAtlasStore } from '../store/atlas-store';

export default function OverviewTab({ onGoToGraph }: { onGoToGraph: () => void }) {
  const nodes = useAtlasStore((state) => state.nodes);
  const entryPoint = useAtlasStore((state) => state.entryPoint);
  const godObjects = useAtlasStore((state) => state.godObjectDetails);
  
  const fileCount = nodes.filter(n => n.type === 'file').length;
  const funcCount = nodes.filter(n => n.type === 'function').length;
  const classCount = nodes.filter(n => n.type === 'class').length;

  return (
    <Box sx={{ p: 4, height: '100%', overflowY: 'auto', bgcolor: 'background.default' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4, color: 'primary.main' }}>Architecture Overview</Typography>
      
      <Grid container spacing={3}>
        {/* Entry Point / Start Here */}
        {entryPoint && (
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3, bgcolor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <Typography variant="h6" sx={{ color: 'primary.light', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Architecture /> Start Here
              </Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                We detected the main entry point for this <strong>{entryPoint.framework}</strong> application at:
              </Typography>
              <Chip label={entryPoint.entryFile} sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.1)', fontWeight: 'bold' }} />
              <Box sx={{ mt: 3 }}>
                <Button variant="contained" onClick={onGoToGraph}>Explore Graph</Button>
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Stats */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%', bgcolor: 'rgba(255,255,255,0.02)' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Key Stats</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Description fontSize="small" /> Files</Typography>
                <Typography fontWeight="bold">{fileCount}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Functions fontSize="small" /> Functions</Typography>
                <Typography fontWeight="bold">{funcCount}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Architecture fontSize="small" /> Classes</Typography>
                <Typography fontWeight="bold">{classCount}</Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Issues */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%', bgcolor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'error.light' }}>
              <Warning /> Issues Detected
            </Typography>
            {godObjects.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {godObjects.map(go => (
                  <Box key={go.nodeId} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight="bold" color="error.light">
                      God Object: {go.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Too many dependencies ({go.totalDegree} total edges)
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography color="success.main">Clean architecture! No major issues detected.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
