import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, InputBase, Button, CircularProgress, Chip, ButtonBase } from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  GitHub as GitHubIcon,
  UploadFile as UploadIcon,
  History as HistoryIcon,
  FactCheck as EvidenceIcon,
  AccountTree as GraphIcon,
  Terminal as TerminalIcon,
} from '@mui/icons-material';
import { getRecentRepos } from '../lib/atlas-api';
import { useAtlasStore } from '../store/atlas-store';
import { useGithubAnalysis, getAnalysisErrorMessage } from '../hooks/useAnalysis';

/** Small public repositories that analyse quickly; docs/accuracy.md reports on all three. */
const EXAMPLES = ['expressjs/express', 'axios/axios', 'sindresorhus/ky'];

const FEATURES = [
  {
    icon: <EvidenceIcon sx={{ fontSize: 20 }} />,
    title: 'Evidence, not verdicts',
    body: 'Circular imports, hotspots, coupling and unused code, each with what was observed, what was inferred and what could not be checked.',
  },
  {
    icon: <GraphIcon sx={{ fontSize: 20 }} />,
    title: 'Explore the graph',
    body: 'A 2D or 3D dependency map with code peek, search and a complexity heatmap. JS/TS is resolved by the TypeScript language server.',
  },
  {
    icon: <TerminalIcon sx={{ fontSize: 20 }} />,
    title: 'CLI and MCP server',
    body: 'The same analysis in your terminal and CI, or as tools for Claude Code, Cursor and other coding agents.',
  },
];

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'just now';
  const units: [number, string][] = [[86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [size, label] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`;
  }
  return '';
}

export default function LandingHero({ onUpload }: { onUpload: () => void }) {
  const [url, setUrl] = useState('');
  const isLoading = useAtlasStore((state) => state.isLoading);
  const setSnackbarMessage = useAtlasStore((state) => state.setSnackbarMessage);
  const githubAnalysis = useGithubAnalysis();

  const { data: recentRepos = [] } = useQuery({
    queryKey: ['recent-repos'],
    queryFn: async () => (await getRecentRepos()).repos,
    // The landing page still works without the cache endpoint.
    retry: false,
  });

  const handleAnalyze = (targetUrl: string = url) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    // Accept "owner/repo" as well as a full URL.
    const finalUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://github.com/${trimmed.replace(/^github\.com\//i, '')}`;
    githubAnalysis.mutate(finalUrl, {
      onError: (err) => setSnackbarMessage(getAnalysisErrorMessage(err)),
    });
  };

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Box sx={{ width: '100%', maxWidth: 880, mx: 'auto', pt: { xs: 6, md: 12 }, pb: 8, px: 2 }}>
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: '2rem', sm: '2.75rem', md: '3.25rem' },
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.08,
              mb: 2,
            }}
          >
            See how a codebase{' '}
            <Box component="span" sx={{ background: 'linear-gradient(135deg, #a5b4fc, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              fits together
            </Box>
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: { xs: '1rem', md: '1.125rem' }, maxWidth: 620, mx: 'auto', lineHeight: 1.6 }}>
            Atlas maps a repository&apos;s dependencies and reports what deserves a closer look, with the evidence behind every claim.
          </Typography>
        </Box>

        <Box
          component="form"
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            handleAnalyze();
          }}
          sx={{
            p: 0.75,
            pl: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 3,
            transition: 'border-color 0.15s, box-shadow 0.15s',
            '&:focus-within': { borderColor: 'rgba(99,102,241,0.7)', boxShadow: '0 0 0 4px rgba(99,102,241,0.15)' },
          }}
        >
          <GitHubIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
          <InputBase
            fullWidth
            placeholder="owner/repo or GitHub URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
            inputProps={{ 'aria-label': 'GitHub repository', spellCheck: false, autoCapitalize: 'off' }}
            sx={{ fontSize: { xs: '0.9375rem', sm: '1.0625rem' }, minWidth: 0 }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!url.trim() || isLoading}
            endIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <ArrowForwardIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: 2,
              px: { xs: 2, sm: 3 },
              height: 44,
              fontSize: '0.875rem',
              flexShrink: 0,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              '&:hover': { background: 'linear-gradient(135deg, #4338ca, #6d28d9)' },
            }}
          >
            Analyze
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mr: 0.5 }}>Try</Typography>
          {EXAMPLES.map((repo) => (
            <Chip
              key={repo}
              label={repo}
              size="small"
              onClick={() => {
                setUrl(repo);
                handleAnalyze(repo);
              }}
              disabled={isLoading}
              sx={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '0.75rem', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          ))}
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mx: 0.5 }}>or</Typography>
          <Button
            size="small"
            startIcon={<UploadIcon sx={{ fontSize: 16 }} />}
            onClick={onUpload}
            disabled={isLoading}
            sx={{ color: '#a5b4fc', fontSize: '0.8125rem' }}
          >
            upload a .zip
          </Button>
        </Box>

        {recentRepos.length > 0 && (
          <Box sx={{ mt: 6 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <HistoryIcon sx={{ fontSize: 14 }} /> Recently analysed
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.25 }}>
              {recentRepos.map((repo) => (
                <ButtonBase
                  key={repo.repo_id}
                  onClick={() => handleAnalyze(repo.repo_id)}
                  disabled={isLoading}
                  sx={{
                    display: 'block',
                    textAlign: 'left',
                    p: 1.75,
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.08)',
                    bgcolor: 'rgba(255,255,255,0.02)',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: 'rgba(255,255,255,0.2)', bgcolor: 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {repo.repo_name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
                    {repo.node_count} nodes · {repo.edge_count} edges{repo.analyzed_at ? ` · ${timeAgo(repo.analyzed_at)}` : ''}
                  </Typography>
                </ButtonBase>
              ))}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mt: 8 }}>
          {FEATURES.map((f) => (
            <Box key={f.title} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(255,255,255,0.015)' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(99,102,241,0.12)', color: '#a5b4fc', mb: 1.5 }}>
                {f.icon}
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', mb: 0.75 }}>{f.title}</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', lineHeight: 1.6 }}>{f.body}</Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 2.5,
            border: '1px solid rgba(255,255,255,0.07)',
            bgcolor: '#0d0d11',
            fontFamily: 'var(--font-geist-mono), monospace',
            fontSize: '0.8125rem',
            color: 'rgba(255,255,255,0.75)',
            overflowX: 'auto',
            whiteSpace: 'pre',
            lineHeight: 1.8,
          }}
        >
          <Box component="span" sx={{ color: 'text.secondary' }}>$ </Box>npx reverse-architect cycles .{'\n'}
          <Box component="span" sx={{ color: 'text.secondary' }}>$ </Box>claude mcp add reverse-architect -- npx -y reverse-architect mcp
        </Box>
      </Box>
    </Box>
  );
}
