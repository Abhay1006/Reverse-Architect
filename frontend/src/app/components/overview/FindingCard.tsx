import React, { useState } from 'react';
import { Box, Typography, Chip, Button, Collapse, ButtonBase, Tooltip } from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  AccountTree as GraphIcon,
  Code as CodeIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import type { Finding } from 'shared';
import { CONFIDENCE_COLORS, FINDING_KINDS, firstLocation } from '../../lib/findings';
import { useAtlasStore } from '../../store/atlas-store';

interface Props {
  finding: Finding;
  /** Whether at least one of the finding's nodes is drawn in the graph. */
  inGraph: boolean;
  defaultOpen?: boolean;
}

export default function FindingCard({ finding, inGraph, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const revealInGraph = useAtlasStore((s) => s.revealInGraph);
  const setCodePeekFile = useAtlasStore((s) => s.setCodePeekFile);
  const canPeek = useAtlasStore((s) => Boolean(s.activeRepoId));
  const meta = FINDING_KINDS[finding.kind];
  const location = firstLocation(finding);

  const peek = (filePath: string) =>
    setCodePeekFile({ filePath, label: filePath.split('/').pop() ?? filePath });

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: open ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)',
        bgcolor: open ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.02)',
        borderLeft: `3px solid ${meta.color}`,
        transition: 'border-color 0.15s, background-color 0.15s',
        '&:hover': { borderColor: 'rgba(255,255,255,0.14)' },
      }}
    >
      <ButtonBase
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{ width: '100%', textAlign: 'left', px: 2, py: 1.5, gap: 1.5, justifyContent: 'flex-start', borderRadius: 2 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', wordBreak: 'break-word', lineHeight: 1.4 }}
          >
            {finding.title}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
            {meta.label} · {finding.evidence.length} evidence item{finding.evidence.length === 1 ? '' : 's'}
            {finding.limitations.length > 0 && ` · ${finding.limitations.length} limitation${finding.limitations.length === 1 ? '' : 's'}`}
          </Typography>
        </Box>
        <Tooltip title={`${finding.confidence} confidence`}>
          <Chip
            size="small"
            label={finding.confidence}
            sx={{
              height: 20,
              fontSize: '0.6875rem',
              fontWeight: 700,
              textTransform: 'capitalize',
              color: CONFIDENCE_COLORS[finding.confidence],
              bgcolor: `${CONFIDENCE_COLORS[finding.confidence]}1a`,
              border: `1px solid ${CONFIDENCE_COLORS[finding.confidence]}40`,
            }}
          />
        </Tooltip>
        <ExpandIcon
          sx={{ fontSize: 20, color: 'text.secondary', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </ButtonBase>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Evidence</Typography>
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {finding.evidence.map((e, i) => (
              <Box component="li" key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Tooltip
                  title={e.basis === 'observed' ? 'Read directly from the source' : 'A conclusion drawn from observations'}
                >
                  <Chip
                    size="small"
                    label={e.basis}
                    sx={{
                      height: 18,
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      mt: '1px',
                      bgcolor: e.basis === 'observed' ? 'rgba(99,102,241,0.15)' : 'rgba(168,85,247,0.12)',
                      color: e.basis === 'observed' ? '#a5b4fc' : '#d8b4fe',
                    }}
                  />
                </Tooltip>
                <Typography sx={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, minWidth: 0, wordBreak: 'break-word' }}>
                  {e.detail}
                  {e.location && (
                    <>
                      {' '}
                      <ButtonBase
                        disabled={!canPeek}
                        onClick={() => peek(e.location!.filePath)}
                        sx={{
                          fontFamily: 'var(--font-geist-mono), monospace',
                          fontSize: '0.75rem',
                          color: canPeek ? '#a5b4fc' : 'text.secondary',
                          borderRadius: 0.5,
                          verticalAlign: 'baseline',
                          '&:hover': { textDecoration: canPeek ? 'underline' : 'none' },
                        }}
                      >
                        {e.location.filePath}
                        {e.location.line ? `:${e.location.line}` : ''}
                      </ButtonBase>
                    </>
                  )}
                </Typography>
              </Box>
            ))}
          </Box>

          {finding.limitations.length > 0 && (
            <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', mb: 0.5 }}>
                <InfoIcon sx={{ fontSize: 14 }} /> What this could not check
              </Typography>
              {finding.limitations.map((l, i) => (
                <Typography key={i} sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                  {l}
                </Typography>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
            {inGraph && (
              <Button
                variant="outlined"
                startIcon={<GraphIcon sx={{ fontSize: 14 }} />}
                onClick={() => revealInGraph(finding.nodeIds)}
                sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.primary' }}
              >
                Show in graph
              </Button>
            )}
            {location && canPeek && (
              <Button
                variant="outlined"
                startIcon={<CodeIcon sx={{ fontSize: 14 }} />}
                onClick={() => peek(location.filePath)}
                sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.primary' }}
              >
                View code
              </Button>
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
