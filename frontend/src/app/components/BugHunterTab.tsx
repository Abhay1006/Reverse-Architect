import { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, List, ListItemButton, Chip } from '@mui/material';
import { BugReport as BugIcon, Architecture as ArchitectureIcon, PlayArrow as PlayIcon } from '@mui/icons-material';
import { useAtlasStore } from '../store/atlas-store';
import { rankSuspects, type Suspect } from '../lib/bug-hunter';

export default function BugHunterTab({ onGoToGraph }: { onGoToGraph: () => void }) {
  const nodes = useAtlasStore(s => s.nodes);
  const edges = useAtlasStore(s => s.edges);
  const setFocusedNode = useAtlasStore(s => s.setFocusedNode);

  const [issueText, setIssueText] = useState("");
  const [suspects, setSuspects] = useState<Suspect[]>([]);

  const handleSearch = () => {
    if (!issueText.trim()) return;

    setSuspects(rankSuspects(issueText, nodes, edges));
  };

  const handleSuspectClick = (nodeId: string) => {
    // Switch to graph tab and focus node
    onGoToGraph();
    // Use setTimeout to ensure the graph component has mounted before firing focus
    setTimeout(() => {
      setFocusedNode(nodeId);
    }, 100);
  };

  return (
    <Box sx={{ p: 4, height: '100%', overflowY: 'auto', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <BugIcon sx={{ color: 'error.main', fontSize: 32 }} /> Bug Hunter
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          Paste a GitHub issue or bug description below. Atlas matches its keywords against file, class and
          function names, then boosts files connected to strong matches, to suggest where to start looking. It is a
          quick heuristic that runs without an LLM, so treat the results as leads, not answers.
        </Typography>

        <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder="E.g., Users are getting disconnected from the socket when they log out..."
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'white', bgcolor: 'rgba(0,0,0,0.2)' } }}
          />
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<PlayIcon />}
            onClick={handleSearch}
            disabled={!issueText.trim()}
            sx={{ fontWeight: 700 }}
          >
            Hunt Bugs
          </Button>
        </Paper>

        {suspects.length > 0 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.light' }}>Top Suspects Found:</Typography>
            <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {suspects.map((s, i) => (
                <Paper key={s.node.id} sx={{ bgcolor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', overflow: 'hidden' }}>
                  <ListItemButton onClick={() => handleSuspectClick(s.node.id)} sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
                      <Chip label={`Match #${i + 1}`} size="small" color="error" sx={{ mr: 2, fontWeight: 800 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>{s.node.data.filePath}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Score: {s.score.toFixed(1)}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ArchitectureIcon fontSize="small" /> {s.reason}
                    </Typography>
                  </ListItemButton>
                </Paper>
              ))}
            </List>
          </Box>
        )}
      </Box>
    </Box>
  );
}
