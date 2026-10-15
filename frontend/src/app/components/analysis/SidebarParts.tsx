"use client";

// Small presentational pieces of the analysis sidebar.

import React from "react";
import {
  Box,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";

/* ── Stat Card ─────────────────────────────────────────────────────────── */

export function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        p: "10px 12px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 2.5,
        transition: "all 0.2s",
        "&:hover": {
          background: "rgba(255,255,255,0.05)",
          borderColor: "rgba(255,255,255,0.08)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 2,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          color: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 700,
            color: "rgba(255,255,255,0.9)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.625rem",
            fontWeight: 500,
            color: "rgba(255,255,255,0.35)",
            mt: 0.25,
          }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

/* ── Issue Accordion ──────────────────────────────────────────────────── */

export function IssueAccordion({
  icon,
  label,
  count,
  color,
  items,
  onItemClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  items: { id: string; label: string; sublabel?: string }[];
  onItemClick?: (id: string) => void;
}) {
  return (
    <Accordion disabled={count === 0} disableGutters>
      <AccordionSummary expandIcon={count > 0 ? <ExpandMoreIcon sx={{ fontSize: 18, color: "text.secondary" }} /> : undefined}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
          <Box sx={{ color, display: "flex", alignItems: "center" }}>{icon}</Box>
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>
            {label}
          </Typography>
          <Box sx={{ ml: "auto", mr: 1 }}>
            <Chip
              label={count}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.625rem",
                fontWeight: 700,
                bgcolor: count > 0 ? color : "rgba(255,255,255,0.05)",
                color: count > 0 ? "#fff" : "rgba(255,255,255,0.3)",
                minWidth: 28,
              }}
            />
          </Box>
        </Box>
      </AccordionSummary>
      {items.length > 0 && (
        <AccordionDetails sx={{ pt: 0, px: 1, pb: 1 }}>
          <List dense disablePadding>
            {items.map((item, idx) => (
              <ListItemButton
                key={`${item.id}-${idx}`}
                onClick={() => onItemClick?.(item.id)}
                sx={{
                  borderRadius: 1.5,
                  py: 0.75,
                  px: 1.5,
                  "&:hover": { background: "rgba(255,255,255,0.05)" },
                }}
              >
                <ListItemText
                  primary={
                    <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.8)" }}>
                      {item.label}
                    </Typography>
                  }
                  secondary={
                    item.sublabel ? (
                      <Typography sx={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.3)" }}>
                        {item.sublabel}
                      </Typography>
                    ) : undefined
                  }
                />
                <Typography
                  sx={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    opacity: 0,
                    transition: "opacity 0.15s",
                    ".MuiListItemButton-root:hover &": { opacity: 1 },
                  }}
                >
                  View
                </Typography>
              </ListItemButton>
            ))}
          </List>
        </AccordionDetails>
      )}
    </Accordion>
  );
}

/* ── Edge Stat ────────────────────────────────────────────────────────── */

export function EdgeStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        p: "6px 10px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
          }}
        />
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.6)" }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
        {count}
      </Typography>
    </Box>
  );
}
