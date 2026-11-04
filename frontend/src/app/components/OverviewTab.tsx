import React, { useMemo, useState } from 'react';
import { Box, Typography, Paper, Grid, Chip, Button, Switch, FormControlLabel, ButtonBase, LinearProgress, Tooltip } from '@mui/material';
import {
  Flag as EntryIcon,
  ContentCopy as CopyIcon,
  CheckCircleOutline as CleanIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import type { AnalysisCoverage, FindingKind } from 'shared';
import { useAtlasStore } from '../store/atlas-store';
import FindingCard from './overview/FindingCard';
import {
  FINDING_KINDS,
  KIND_ORDER,
  countByKind,
  findingsToMarkdown,
  meetsConfidence,
  sortFindings,
} from '../lib/findings';

const panelSx = {
  p: 2.5,
  bgcolor: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.07)',
  backgroundImage: 'none',
} as const;

const ANALYZER_LABELS: Record<string, string> = {
  lsp: 'TypeScript language server',
  text: 'Regex text extractor',
  schema: 'Schema parser',
  unknown: 'Unknown',
};

export default function OverviewTab() {
  const nodes = useAtlasStore((s) => s.nodes);
  const edgeCount = useAtlasStore((s) => s.edges.length);
  const entryPoint = useAtlasStore((s) => s.entryPoint);
  const findings = useAtlasStore((s) => s.findings);
  const coverage = useAtlasStore((s) => s.coverage);
  const revealInGraph = useAtlasStore((s) => s.revealInGraph);
  const setSnackbarMessage = useAtlasStore((s) => s.setSnackbarMessage);

  const [kindFilter, setKindFilter] = useState<FindingKind | null>(null);
  const [showLow, setShowLow] = useState(false);

  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const stats = useMemo(() => {
    const count = (type: string) => nodes.filter((n) => n.type === type).length;
    return [
      { label: 'Files', value: count('file') },
      { label: 'Classes', value: count('class') },
      { label: 'Interfaces', value: count('interface') },
      { label: 'Functions', value: count('function') },
      { label: 'Dependencies', value: edgeCount },
      { label: 'Tables', value: count('database') },
    ].filter((s) => s.value > 0 || s.label === 'Files');
  }, [nodes, edgeCount]);

  const atConfidence = useMemo(
    () => findings.filter((f) => meetsConfidence(f, showLow ? 'low' : 'medium')),
    [findings, showLow],
  );
  const lowCount = findings.length - findings.filter((f) => meetsConfidence(f, 'medium')).length;
  const counts = useMemo(() => countByKind(atConfidence), [atConfidence]);
  const visible = useMemo(
    () => sortFindings(kindFilter ? atConfidence.filter((f) => f.kind === kindFilter) : atConfidence),
    [atConfidence, kindFilter],
  );
  const issueCount = atConfidence.filter((f) => f.kind !== 'pattern').length;

  const entryNode = entryPoint
    ? nodes.find((n) => n.type === 'file' && n.data?.filePath === entryPoint.entryFile)
    : undefined;

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(findingsToMarkdown(visible));
      setSnackbarMessage(`Copied ${visible.length} finding${visible.length === 1 ? '' : 's'} as Markdown`);
    } catch {
      setSnackbarMessage('Copy failed: the browser blocked clipboard access');
    }
  };

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 1280, mx: 'auto', p: { xs: 2, md: 4 } }}>
        {/* Heading */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <Box>
            <Typography component="h1" sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 800, letterSpacing: '-0.02em' }}>
              Architecture report
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mt: 0.5 }}>
              {issueCount === 0
                ? 'No issues found at this confidence level.'
                : `${issueCount} thing${issueCount === 1 ? '' : 's'} worth a look.`}{' '}
              Every finding is a claim to check, with the evidence behind it.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<CopyIcon sx={{ fontSize: 14 }} />}
            onClick={copyMarkdown}
            disabled={visible.length === 0}
            sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.primary' }}
          >
            Copy as Markdown
          </Button>
        </Box>

        {/* Kind tiles double as filters */}
        <Box
          role="group"
          aria-label="Filter findings by kind"
          sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 1.5, mb: 3 }}
        >
          {KIND_ORDER.map((kind) => {
            const meta = FINDING_KINDS[kind];
            const active = kindFilter === kind;
            return (
              <ButtonBase
                key={kind}
                aria-pressed={active}
                onClick={() => setKindFilter(active ? null : kind)}
                sx={{
                  display: 'block',
                  textAlign: 'left',
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: active ? meta.color : 'rgba(255,255,255,0.07)',
                  bgcolor: active ? `${meta.color}14` : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: active ? meta.color : 'rgba(255,255,255,0.18)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: meta.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>{meta.label}</Typography>
                </Box>
                <Typography
                  sx={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    mt: 0.5,
                    fontVariantNumeric: 'tabular-nums',
                    color: counts[kind] > 0 && kind !== 'pattern' ? 'text.primary' : 'text.secondary',
                  }}
                >
                  {counts[kind]}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>

        <Grid container spacing={3}>
          {/* Findings */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>
                  {kindFilter ? FINDING_KINDS[kindFilter].label : 'All findings'}
                </Typography>
                {kindFilter && (
                  <Chip size="small" label="Clear filter" onDelete={() => setKindFilter(null)} onClick={() => setKindFilter(null)} sx={{ height: 22 }} />
                )}
              </Box>
              <FormControlLabel
                control={<Switch size="small" checked={showLow} onChange={(e) => setShowLow(e.target.checked)} />}
                label={`Include low confidence${lowCount > 0 ? ` (${lowCount})` : ''}`}
                slotProps={{ typography: { sx: { fontSize: '0.75rem', color: 'text.secondary' } } }}
                sx={{ mr: 0 }}
              />
            </Box>
            {kindFilter && (
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1.5 }}>
                {FINDING_KINDS[kindFilter].blurb}
              </Typography>
            )}

            {visible.length === 0 ? (
              <Paper elevation={0} sx={{ ...panelSx, textAlign: 'center', py: 5 }}>
                <CleanIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                <Typography sx={{ fontWeight: 600 }}>Nothing to report here</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mt: 0.5 }}>
                  {!showLow && lowCount > 0
                    ? `${lowCount} low-confidence finding${lowCount === 1 ? ' is' : 's are'} hidden. Turn on “Include low confidence” to see ${lowCount === 1 ? 'it' : 'them'}.`
                    : 'Atlas found nothing of this kind.'}
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {visible.map((f, i) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    inGraph={f.nodeIds.some((id) => nodeIds.has(id))}
                    defaultOpen={i === 0 && f.kind !== 'pattern'}
                  />
                ))}
              </Box>
            )}
          </Grid>

          {/* Context */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {entryPoint && (
                <Paper elevation={0} sx={{ ...panelSx, bgcolor: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.25)' }}>
                  <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, color: '#a5b4fc', fontSize: '0.875rem' }}>
                    <EntryIcon sx={{ fontSize: 18 }} /> Start here
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mt: 1 }}>
                    Entry point{entryPoint.framework !== 'unknown' ? ` (${entryPoint.framework})` : ''}
                    {entryPoint.packageName ? ` of ${entryPoint.packageName}` : ''}:
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '0.8125rem', mt: 0.5, wordBreak: 'break-all' }}>
                    {entryPoint.entryFile}
                  </Typography>
                  {entryNode && (
                    <Button variant="contained" onClick={() => revealInGraph([entryNode.id])} sx={{ mt: 2 }}>
                      Explore from here
                    </Button>
                  )}
                </Paper>
              )}

              <Paper elevation={0} sx={panelSx}>
                <Typography component="h2" sx={{ fontWeight: 700, fontSize: '0.875rem', mb: 1.5 }}>Project</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  {stats.map((s) => (
                    <Box key={s.label}>
                      <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s.value}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{s.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>

              {coverage && <CoveragePanel coverage={coverage} />}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

function CoveragePanel({ coverage }: { coverage: AnalysisCoverage }) {
  const analyzers = Object.entries(coverage.filesByAnalyzer).filter(([, n]) => n > 0);
  const total = analyzers.reduce((sum, [, n]) => sum + n, 0) || 1;

  return (
    <Paper elevation={0} sx={panelSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Coverage</Typography>
        <Tooltip title="How each file was read. Language-server results resolve imports properly; regex results match names and are rougher.">
          <InfoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        </Tooltip>
      </Box>
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1.5 }}>
        {coverage.filesInGraph} of {coverage.filesParsed} parsed files are in the graph
        {coverage.graphScope === 'entry-points' ? ' (those reachable from the entry points).' : ' (no entry point found, so all of them).'}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {analyzers.map(([name, n]) => (
          <Box key={name}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', mb: 0.5 }}>
              <Typography sx={{ fontSize: 'inherit' }}>{ANALYZER_LABELS[name] ?? name}</Typography>
              <Typography sx={{ fontSize: 'inherit', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{n}</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(n / total) * 100}
              sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: name === 'lsp' ? '#6366f1' : name === 'text' ? '#f59e0b' : '#10b981' } }}
            />
          </Box>
        ))}
      </Box>
      {coverage.limitations.length > 0 && (
        <Box component="ul" sx={{ m: 0, mt: 1.5, pl: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {coverage.limitations.map((l, i) => (
            <Typography component="li" key={i} sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5 }}>
              {l}
            </Typography>
          ))}
        </Box>
      )}
    </Paper>
  );
}
