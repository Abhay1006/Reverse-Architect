import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import Canvas from './Canvas';
import OverviewTab from './OverviewTab';
import FilesTab from './FilesTab';
import BugHunterTab from './BugHunterTab';
import { useAtlasStore } from '../store/atlas-store';

export default function Dashboard() {
  const [tabIndex, setTabIndex] = useState(0);
  const nodes = useAtlasStore((state) => state.nodes);
  
  if (nodes.length === 0) return null;

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', bgcolor: 'rgba(12,12,15,0.95)' }}>
        <Tabs value={tabIndex} onChange={handleChange} textColor="inherit" indicatorColor="primary" sx={{ minHeight: 48 }}>
          <Tab label="Overview" sx={{ textTransform: 'none', minHeight: 48, fontWeight: 600 }} />
          <Tab label="Graph" sx={{ textTransform: 'none', minHeight: 48, fontWeight: 600 }} />
          <Tab label="Files" sx={{ textTransform: 'none', minHeight: 48, fontWeight: 600 }} />
          <Tab label="Bug Hunter" sx={{ textTransform: 'none', minHeight: 48, fontWeight: 600, color: 'error.main', '&.Mui-selected': { color: 'error.light' } }} />
        </Tabs>
      </Box>
      
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tabIndex === 0 && <OverviewTab onGoToGraph={() => setTabIndex(1)} />}
        
        {/* We keep Canvas always mounted but visually hidden so React Flow doesn't lose state/layout */}
        <Box sx={{ position: 'absolute', inset: 0, opacity: tabIndex === 1 ? 1 : 0, pointerEvents: tabIndex === 1 ? 'auto' : 'none' }}>
          <Canvas />
        </Box>

        {tabIndex === 2 && <FilesTab />}
        {tabIndex === 3 && <BugHunterTab onGoToGraph={() => setTabIndex(1)} />}
      </Box>
    </Box>
  );
}
