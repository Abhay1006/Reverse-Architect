"use client";

import React, { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  Typography,
  Tooltip,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  Menu as MenuIcon,
  FileDownload as ExportIcon,
  Refresh as ReAnalyzeIcon,
  Analytics as AnalysisIcon,
  Architecture as AtlasIcon,
  Label as LabelIcon,
} from "@mui/icons-material";
import { toPng } from "html-to-image";
import Dashboard from "./components/Dashboard";
import Upload from "./components/Upload";
import AnalysisSidebar from "./components/AnalysisSidebar";
import SearchBar from "./components/SearchBar";
import FolderTree from "./components/FolderTree";
import Breadcrumb from "./components/Breadcrumb";
import LandingHero from "./components/LandingHero";
import { useAtlasStore } from "./store/atlas-store";
import { ErrorBoundary } from "./components/ErrorBoundary";
import GraphSkeleton from "./components/GraphSkeleton";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const nodes = useAtlasStore((state) => state.nodes);
  const edges = useAtlasStore((state) => state.edges);
  const analysisResults = useAtlasStore((state) => state.analysisResults);
  const visibleNodeTypes = useAtlasStore((state) => state.visibleNodeTypes);
  const toggleNodeType = useAtlasStore((state) => state.toggleNodeType);
  const showEdgeLabels = useAtlasStore((state) => state.showEdgeLabels);
  const toggleEdgeLabels = useAtlasStore((state) => state.toggleEdgeLabels);
  const isLoading = useAtlasStore((state) => state.isLoading);
  const snackbarMessage = useAtlasStore((state) => state.snackbarMessage);
  const setSnackbarMessage = useAtlasStore((state) => state.setSnackbarMessage);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFolderTreeOpen, setIsFolderTreeOpen] = useState(true);

  const triggerFitView = useAtlasStore((state) => state.triggerFitView);

  const handleExportPng = () => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;

    toPng(el, {
      backgroundColor: "#0a0a0c",
      pixelRatio: 2, // High resolution output
    })
      .then((dataUrl) => {
        const a = document.createElement("a");
        a.setAttribute("download", `atlas-architecture-${Date.now()}.png`);
        a.setAttribute("href", dataUrl);
        a.click();
      })
      .catch((err) => {
        console.error("Failed to export image", err);
      });
  };

  useKeyboardShortcuts([
    {
      key: "e",
      ctrl: true,
      action: handleExportPng,
      description: "Export graph to PNG",
    },
    {
      key: "f",
      ctrl: true,
      action: triggerFitView,
      description: "Fit graph to view",
    },
    {
      key: "Escape",
      action: () => setIsSidebarOpen(false),
      description: "Close sidebar",
    },
    {
      key: "l",
      action: toggleEdgeLabels,
      description: "Toggle edge labels",
    },
    {
      key: "1",
      action: () => toggleNodeType("file"),
      description: "Toggle file nodes filter",
    },
    {
      key: "2",
      action: () => toggleNodeType("class"),
      description: "Toggle class nodes filter",
    },
    {
      key: "3",
      action: () => toggleNodeType("interface"),
      description: "Toggle interface nodes filter",
    },
    {
      key: "4",
      action: () => toggleNodeType("function"),
      description: "Toggle function nodes filter",
    },
    {
      key: "5",
      action: () => toggleNodeType("database"),
      description: "Toggle database nodes filter",
    },
  ]);

  if (!mounted) {
    return (
      <div style={{ width: "100vw", height: "100vh", backgroundColor: "#0a0a0c" }} />
    );
  }

  return (
    <Box component="main" sx={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", bgcolor: "background.default" }}>
      {/* ── Folder Tree Sidebar ── */}
      {isFolderTreeOpen && nodes.length > 0 && (
        <Box
          component="aside"
          sx={{
            width: 260,
            minWidth: 260,
            height: "100vh",
            borderRight: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(12,12,15,0.95)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <FolderTree />
        </Box>
      )}

      {/* ── Main Content ── */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Header Bar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            background: "rgba(12,12,15,0.8)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Toolbar
            variant="dense"
            sx={{
              gap: 1.5,
              px: 2.5,
              minHeight: 48,
            }}
          >
            {/* Left side */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Tooltip title={isFolderTreeOpen ? "Hide sidebar" : "Show sidebar"}>
                <IconButton
                  onClick={() => setIsFolderTreeOpen(!isFolderTreeOpen)}
                  size="small"
                  sx={{
                    color: "text.secondary",
                    bgcolor: "rgba(255,255,255,0.04)",
                    borderRadius: 2,
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.08)",
                      color: "text.primary",
                    },
                  }}
                >
                  <MenuIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Typography
                variant="h6"
                sx={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: "-0.05em",
                  color: "rgba(255,255,255,0.9)",
                  whiteSpace: "nowrap",
                }}
              >
                ATLAS
              </Typography>
            </Box>

            {/* Spacer */}
            <Box sx={{ flex: 1 }} />

            {/* Right side */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <SearchBar />

              <Button
                onClick={handleExportPng}
                size="small"
                variant="outlined"
                startIcon={<ExportIcon sx={{ fontSize: 14 }} />}
                sx={{
                  color: "text.secondary",
                  borderColor: "rgba(255,255,255,0.1)",
                  fontSize: "0.6875rem",
                  "&:hover": {
                    borderColor: "rgba(255,255,255,0.2)",
                    color: "text.primary",
                    background: "rgba(255,255,255,0.04)",
                  },
                }}
              >
                Export
              </Button>

              <Button
                onClick={() => setIsUploadOpen(true)}
                size="small"
                variant="contained"
                startIcon={<ReAnalyzeIcon sx={{ fontSize: 14 }} />}
                sx={{
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "0.6875rem",
                  boxShadow: "0 0 12px rgba(99,102,241,0.1)",
                  "&:hover": {
                    background: "rgba(99,102,241,0.25)",
                    borderColor: "rgba(99,102,241,0.5)",
                    color: "white",
                  },
                }}
              >
                Analyze
              </Button>

              <Button
                onClick={() => setIsSidebarOpen(true)}
                size="small"
                variant="contained"
                startIcon={<AnalysisIcon sx={{ fontSize: 14 }} />}
                sx={{
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "0.6875rem",
                  boxShadow: "0 0 12px rgba(99,102,241,0.1)",
                  "&:hover": {
                    background: "rgba(99,102,241,0.25)",
                    borderColor: "rgba(99,102,241,0.5)",
                    color: "white",
                  },
                }}
              >
                Analysis
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Breadcrumb */}
        {nodes.length > 0 && <Breadcrumb />}

        {/* Canvas / Empty State */}
        <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <ErrorBoundary>
            {isLoading ? (
              <GraphSkeleton />
            ) : nodes.length === 0 ? (
              <LandingHero />
            ) : (
              <Dashboard />
            )}
          </ErrorBoundary>
        </Box>
      </Box>

      <Upload isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
      
      {isSidebarOpen && (
        <AnalysisSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarMessage(null)}
          severity={snackbarMessage?.toLowerCase().includes("failed") ? "error" : "success"}
          variant="filled"
          sx={{ width: "100%", borderRadius: 2 }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
