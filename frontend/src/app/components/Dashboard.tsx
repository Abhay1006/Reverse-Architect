import React from 'react';
import { Box, Tabs, Tab, Badge } from '@mui/material';
import {
  Assessment as OverviewIcon,
  AccountTree as GraphIcon,
  Description as FilesIcon,
  BugReport as BugIcon,
  AutoAwesome as AiIcon,
} from '@mui/icons-material';
import Canvas from './Canvas';
import OverviewTab from './OverviewTab';
import FilesTab from './FilesTab';
import BugHunterTab from './BugHunterTab';
import AiAssistantTab from './AiAssistantTab';
import CodePeekPanel from './CodePeekPanel';
import { useAtlasStore, type DashboardTab } from '../store/atlas-store';
import { isIssue } from '../lib/findings';

const TABS: { value: DashboardTab; label: string; icon: React.ReactElement }[] = [
  { value: 'overview', label: 'Overview', icon: <OverviewIcon sx={{ fontSize: 16 }} /> },
  { value: 'graph', label: 'Graph', icon: <GraphIcon sx={{ fontSize: 16 }} /> },
  { value: 'files', label: 'Files', icon: <FilesIcon sx={{ fontSize: 16 }} /> },
  { value: 'bug-hunter', label: 'Bug Hunter', icon: <BugIcon sx={{ fontSize: 16 }} /> },
  { value: 'ai', label: 'AI Assistant', icon: <AiIcon sx={{ fontSize: 16 }} /> },
];

export default function Dashboard() {
  const activeTab = useAtlasStore((state) => state.activeTab);
  const setActiveTab = useAtlasStore((state) => state.setActiveTab);
  const nodeCount = useAtlasStore((state) => state.nodes.length);
  const issueCount = useAtlasStore(
    (state) => state.findings.filter((f) => isIssue(f) && f.confidence !== 'low').length,
  );

  if (nodeCount === 0) return null;

  const goToGraph = () => setActiveTab('graph');

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(12,12,15,0.95)' }}>
        <Tabs
          value={activeTab}
          onChange={(_, value: DashboardTab) => setActiveTab(value)}
          textColor="inherit"
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons={false}
          sx={{ minHeight: 44, px: 1 }}
        >
          {TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              iconPosition="start"
              icon={
                tab.value === 'overview' && issueCount > 0 ? (
                  <Badge badgeContent={issueCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16, right: -2 } }}>
                    {tab.icon}
                  </Badge>
                ) : (
                  tab.icon
                )
              }
              label={tab.label}
              sx={{
                textTransform: 'none',
                minHeight: 44,
                fontWeight: 600,
                fontSize: '0.8125rem',
                gap: 0.75,
                color: 'text.secondary',
                '&.Mui-selected': { color: 'text.primary' },
              }}
            />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/*
          Canvas stays mounted but hidden so React Flow keeps its layout and
          viewport. Not `visibility: hidden`: React Flow sets `visibility:
          visible` on its nodes, which overrides a hidden parent. `inert`
          keeps the invisible nodes from catching clicks or focus.
        */}
        <Box
          inert={activeTab !== 'graph'}
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: activeTab === 'graph' ? 1 : 0,
          }}
        >
          <Canvas />
        </Box>

        {activeTab !== 'graph' && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 2, bgcolor: 'background.default' }}>
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'files' && <FilesTab />}
            {activeTab === 'bug-hunter' && <BugHunterTab onGoToGraph={goToGraph} />}
            {activeTab === 'ai' && <AiAssistantTab />}
          </Box>
        )}
      </Box>

      {/* Outside the tab panels so "View code" works from every tab. */}
      <CodePeekPanel />
    </Box>
  );
}
