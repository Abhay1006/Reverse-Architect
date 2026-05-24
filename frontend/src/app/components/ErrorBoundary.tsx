"use client";

import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from "@mui/icons-material";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: 300,
              gap: 2,
              p: 4,
            }}
          >
            <ErrorIcon sx={{ fontSize: 48, color: "error.main", opacity: 0.8 }} />
            <Typography variant="h6" sx={{ color: "error.light", fontWeight: 700 }}>
              Something went wrong
            </Typography>
            <Typography
              sx={{
                color: "text.secondary",
                fontSize: "0.875rem",
                textAlign: "center",
                maxWidth: 400,
                fontFamily: "monospace",
                bgcolor: "rgba(255,255,255,0.03)",
                p: 1.5,
                borderRadius: 1,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {this.state.error?.message || "An unexpected error occurred"}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => this.setState({ hasError: false })}
              sx={{
                mt: 1,
                color: "text.secondary",
                borderColor: "rgba(255,255,255,0.15)",
                "&:hover": {
                  borderColor: "rgba(255,255,255,0.3)",
                  bgcolor: "rgba(255,255,255,0.04)",
                },
              }}
            >
              Try Again
            </Button>
          </Box>
        )
      );
    }
    return this.props.children;
  }
}
