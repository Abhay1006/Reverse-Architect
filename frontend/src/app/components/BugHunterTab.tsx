import React, { useState, useMemo } from 'react';
import { Box, Typography, TextField, Button, Paper, List, ListItemButton, Chip } from '@mui/material';
import { BugReport as BugIcon, Architecture as ArchitectureIcon, PlayArrow as PlayIcon } from '@mui/icons-material';
import { useAtlasStore } from '../store/atlas-store';

export default function BugHunterTab({ onGoToGraph }: { onGoToGraph: () => void }) {
  const nodes = useAtlasStore(s => s.nodes);
  const edges = useAtlasStore(s => s.edges);
  const setFocusedNode = useAtlasStore(s => s.setFocusedNode);
  const setPanToNode = useAtlasStore(s => s.panToNode);

  const [issueText, setIssueText] = useState("");
  const [suspects, setSuspects] = useState<{ node: any, score: number, reason: string }[]>([]);

  const handleSearch = () => {
    if (!issueText.trim()) return;

    // 1. Tokenize & Clean
    const rawWords = issueText.match(/[a-zA-Z0-9_]{3,}/g) || [];
    const stopwords = new Set(["the", "and", "when", "bug", "fix", "issue", "error", "fails", "this", "that", "with", "from", "have", "been", "there"]);
    const terms = Array.from(new Set(rawWords.map(w => w.toLowerCase()).filter(w => !stopwords.has(w))));

    if (terms.length === 0) return;

    // 2. Initial BM25 / TF Scoring
    const scores = new Map<string, number>();
    const reasons = new Map<string, string>();

    nodes.forEach(n => {
      let score = 0;
      let matchedTerms: string[] = [];

      const label = (n.data?.label as string) || "";
      const path = (n.data?.filePath as string) || "";
      const meta = n.data?.metadata as any;
      
      const properties = meta?.properties?.join(" ") || "";
      const methods = meta?.methods?.join(" ") || "";
      const entities = meta?.entities?.map((e:any) => e.name).join(" ") || "";

      const bigString = `${label} ${path} ${properties} ${methods} ${entities}`.toLowerCase();

      terms.forEach(term => {
        let termScore = 0;
        
        // Exact matches in filename are high value
        if (label.toLowerCase().includes(term)) termScore += 10;
        if (path.toLowerCase().includes(term)) termScore += 5;
        
        // Occurrences in content (functions, variables)
        const occurrences = bigString.split(term).length - 1;
        termScore += occurrences * 2;

        if (termScore > 0) {
          score += termScore;
          matchedTerms.push(term);
        }
      });

      if (score > 0) {
        scores.set(n.id, score);
        reasons.set(n.id, `Matched keywords: ${matchedTerms.join(", ")}`);
      }
    });

    // 3. Spreading Activation (Architectural Context)
    // If a node is connected to a highly suspected node, bump its score!
    const finalScores = new Map(scores);
    edges.forEach(e => {
      const s1 = scores.get(e.source) || 0;
      const s2 = scores.get(e.target) || 0;

      if (s1 > 0) {
        finalScores.set(e.target, (finalScores.get(e.target) || 0) + s1 * 0.4);
        if (!reasons.has(e.target)) reasons.set(e.target, `Architecturally coupled to suspected node`);
      }
      if (s2 > 0) {
        finalScores.set(e.source, (finalScores.get(e.source) || 0) + s2 * 0.4);
        if (!reasons.has(e.source)) reasons.set(e.source, `Architecturally coupled to suspected node`);
      }
    });

    // 4. Sort & Format
    const results = Array.from(finalScores.entries())
      .map(([id, score]) => ({
        node: nodes.find(n => n.id === id)!,
        score,
        reason: reasons.get(id) || ""
      }))
      .filter(r => r.node && r.node.type === 'file') // Only suggest files
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5

    setSuspects(results);
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
          Paste a GitHub issue or bug description below. Atlas will use a heuristic text-search combined with 
          architectural spreading-activation (PageRank) to find exactly where in the codebase the issue lives—without using an LLM.
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
