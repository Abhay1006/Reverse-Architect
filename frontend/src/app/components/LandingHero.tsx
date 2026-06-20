import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, CircularProgress, Chip, Paper } from '@mui/material';
import { ArrowForward as ArrowForwardIcon, Code as CodeIcon, GitHub as GitHubIcon } from '@mui/icons-material';
import { getRecentRepos, analyzeGithub, toStoreGraph } from '../lib/atlas-api';
import { useAtlasStore } from '../store/atlas-store';

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15);
}

export default function LandingHero() {
  const [url, setUrl] = useState('');
  const isLoading = useAtlasStore((state) => state.isLoading);
  const setIsLoading = useAtlasStore((state) => state.setIsLoading);
  const progressText = useAtlasStore((state) => state.progressText);
  const setProgressText = useAtlasStore((state) => state.setProgressText);
  const [recentRepos, setRecentRepos] = useState<{ repo_id: string; repo_name: string; analyzed_at: string; node_count: number; edge_count: number }[]>([]);
  const setGraph = useAtlasStore((state) => state.setGraph);
  const setSnackbarMessage = useAtlasStore((state) => state.setSnackbarMessage);

  useEffect(() => {
    getRecentRepos().then(data => setRecentRepos(data.repos)).catch(console.error);
  }, []);

  const handleAnalyze = async (targetUrl: string = url) => {
    if (!targetUrl) return;
    
    // Add https://github.com/ prefix if it's just user/repo
    let finalUrl = targetUrl.trim();
    if (!finalUrl.startsWith('http')) {
      finalUrl = `https://github.com/${finalUrl}`;
    }

    const sessionId = generateSessionId();
    setIsLoading(true);
    setProgressText('Initializing...');

    const eventSource = new EventSource(`/api/analyze/progress?sessionId=${sessionId}`);
    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.message) {
          setProgressText(event.message);
        }
        if (event.step === 'done' || event.step === 'error') {
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE', err);
      }
    };

    try {
      const result = await analyzeGithub(finalUrl, sessionId);
      const storeGraph = toStoreGraph(result);
      setGraph(
        storeGraph.nodes,
        storeGraph.edges,
        storeGraph.analysis,
        storeGraph.godObjectDetails,
        storeGraph.deadCodeDetails,
        storeGraph.entryPoint
      );
    } catch (err) {
      console.error('Analysis failed:', err);
      setSnackbarMessage('Analysis failed. Check console for details.');
    } finally {
      eventSource.close();
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto', mt: 10, px: 3 }}>
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #a855f7, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Understand any codebase in minutes
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400 }}>
          Paste a GitHub URL to generate an interactive architecture map instantly.
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, mb: 6 }}>
        <GitHubIcon sx={{ mx: 2, color: 'text.secondary' }} />
        <TextField
          fullWidth
          variant="standard"
          placeholder="facebook/react or https://github.com/expressjs/express"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          InputProps={{ disableUnderline: true, sx: { fontSize: '1.1rem', color: 'text.primary' } }}
          disabled={isLoading}
        />
        <Button
          variant="contained"
          onClick={() => handleAnalyze()}
          disabled={!url || isLoading}
          endIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardIcon />}
          sx={{
            borderRadius: 2, px: 3, py: 1.5, textTransform: 'none', fontSize: '1rem', fontWeight: 600,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            whiteSpace: 'nowrap',
            minWidth: 140,
            '&:hover': { background: 'linear-gradient(135deg, #4338ca, #6d28d9)' }
          }}
        >
          {isLoading ? (
            <Typography sx={{ fontSize: '0.85rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {progressText}
            </Typography>
          ) : 'Analyze'}
        </Button>
      </Paper>

      {recentRepos.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Recently Analyzed
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {recentRepos.map(repo => (
              <Chip
                key={repo.repo_id}
                icon={<CodeIcon fontSize="small" />}
                label={repo.repo_name}
                onClick={() => handleAnalyze(repo.repo_id)}
                disabled={isLoading}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)', color: 'text.primary', borderRadius: 2, py: 2.5, px: 1,
                  border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', transform: 'translateY(-2px)' }
                }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
