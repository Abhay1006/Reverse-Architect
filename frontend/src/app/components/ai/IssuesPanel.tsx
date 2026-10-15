"use client";

import React from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Avatar,
  Alert,
} from "@mui/material";
import {
  BugReport as BugIcon,
  Build as BuildIcon,
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import MarkdownContent from "./MarkdownContent";
import { isUploadRepo } from "./types";
import type { useIssueFixer } from "./useIssueFixer";

type IssuesPanelProps = ReturnType<typeof useIssueFixer> & { activeRepoId: string | null };

/** Open GitHub issues for the repository, with an AI-suggested fix per issue. */
export default function IssuesPanel({
  activeRepoId,
  issues,
  areIssuesLoading,
  issuesError,
  fetchIssues,
  selectedIssue,
  setSelectedIssue,
  fixSuggestion,
  isFixLoading,
  fixIssue,
}: IssuesPanelProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
    {isUploadRepo(activeRepoId) ? (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "rgba(255,255,255,0.4)",
          p: 4,
          textAlign: "center",
        }}
      >
        <BugIcon sx={{ fontSize: 40, mb: 1.5 }} />
        <Typography variant="body2" sx={{ maxWidth: 400 }}>
          This repository was uploaded locally via a zip file. Issue Fixer is only available for analyzed public GitHub repositories.
        </Typography>
      </Box>
    ) : !selectedIssue ? (
      // Issue List View
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 3, py: 2, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Typography variant="subtitle2" sx={{ color: "white", fontWeight: 700 }}>
            Open Repository Issues
          </Typography>
          <IconButton size="small" onClick={() => void fetchIssues()} disabled={areIssuesLoading} sx={{ color: "rgba(255,255,255,0.6)" }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {areIssuesLoading ? (
            <Box sx={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
              <CircularProgress size={20} sx={{ color: "info.main" }} />
              <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>
                Retrieving open issues from GitHub...
              </Typography>
            </Box>
          ) : issuesError ? (
            <Alert severity="error" sx={{ bgcolor: "rgba(239, 68, 68, 0.1)", color: "error.light", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
              {issuesError}
            </Alert>
          ) : issues.length === 0 ? (
            <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8125rem", textAlign: "center", my: 4 }}>
              No open issues found for this repository.
            </Typography>
          ) : (
            issues.map((issue) => (
              <Card
                key={issue.number}
                onClick={() => setSelectedIssue(issue)}
                sx={{
                  bgcolor: "rgba(25, 25, 30, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  "&:hover": {
                    bgcolor: "rgba(25, 25, 30, 0.7)",
                    borderColor: "info.main",
                  },
                }}
              >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1, gap: 2 }}>
                    <Typography sx={{ color: "white", fontSize: "0.875rem", fontWeight: 600 }}>
                      #{issue.number} {issue.title}
                    </Typography>
                    <Chip size="small" label="Open" color="success" variant="outlined" sx={{ height: 18, fontSize: "0.625rem" }} />
                  </Box>

                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1.5 }}>
                    {issue.labels.map((l) => (
                      <Chip
                        key={l.name}
                        label={l.name}
                        size="small"
                        style={{
                          backgroundColor: `#${l.color}22`,
                          color: `#${l.color}`,
                          border: `1px solid #${l.color}44`,
                          fontSize: "0.625rem",
                          height: 18,
                        }}
                      />
                    ))}
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Avatar src={issue.user.avatar_url} sx={{ width: 18, height: 18 }} />
                    <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6875rem" }}>
                      opened by {issue.user.login} on {new Date(issue.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      </Box>
    ) : (
      // Issue Fix Details View
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 3,
            py: 1.5,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            bgcolor: "rgba(15,15,20,0.3)",
          }}
        >
          <IconButton size="small" onClick={() => setSelectedIssue(null)} sx={{ color: "white" }}>
            <BackIcon fontSize="small" />
          </IconButton>
          <Typography sx={{ color: "white", fontSize: "0.8125rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Issue #{selectedIssue.number}: {selectedIssue.title}
          </Typography>
        </Box>

        {/* Details Scroll Area */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 3, display: "flex", flexDirection: "column", gap: 3.5 }}>
          {/* Issue description card */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Typography sx={{ color: "white", fontSize: "0.8125rem", fontWeight: 700, mb: 1 }}>
              Description
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", whiteSpace: "pre-wrap", maxHeight: 150, overflowY: "auto" }}>
              {selectedIssue.body || "No description provided."}
            </Typography>
          </Paper>

          {/* Suggest Fix Button */}
          <Box>
            <Button
              variant="contained"
              disabled={isFixLoading}
              startIcon={isFixLoading ? <CircularProgress size={14} color="inherit" /> : <BuildIcon fontSize="small" />}
              onClick={() => void fixIssue(selectedIssue)}
              sx={{
                bgcolor: "info.main",
                color: "black",
                fontWeight: 700,
                textTransform: "none",
                fontSize: "0.8125rem",
                "&:hover": { bgcolor: "info.light" },
                "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" },
              }}
            >
              {isFixLoading ? "Analyzing Repo and Suggesting Fix..." : "Analyze & Suggest Code Fix"}
            </Button>
          </Box>

          {/* Fix suggestion display */}
          {(fixSuggestion || isFixLoading) && (
            <Box>
              <Typography sx={{ color: "white", fontSize: "0.875rem", fontWeight: 700, mb: 1.5 }}>
                AI Fix Suggestion
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2.5,
                  bgcolor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                }}
              >
                {fixSuggestion ? (
                  <MarkdownContent text={fixSuggestion} />
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <CircularProgress size={14} sx={{ color: "info.main" }} />
                    <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>
                      AI is building code suggestion...
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Box>
          )}
        </Box>
      </Box>
    )}
  </Box>
  );
}
