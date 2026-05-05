"use client";

import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  Typography,
  Tooltip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  FileDownload as ExportIcon,
  Refresh as ReAnalyzeIcon,
  Analytics as AnalysisIcon,
  Architecture as AtlasIcon,
} from "@mui/icons-material";
import { toPng } from "html-to-image";
import Canvas from "./components/Canvas";
import Upload from "./components/Upload";
import AnalysisSidebar from "./components/AnalysisSidebar";
import SearchBar from "./components/SearchBar";
import FolderTree from "./components/FolderTree";
import Breadcrumb from "./components/Breadcrumb";
import LandingHero from "./components/LandingHero";
import { useAtlasStore } from "./store/atlas-store";

export default function Home() {
  const nodes = useAtlasStore((state) => state.nodes);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFolderTreeOpen, setIsFolderTreeOpen] = useState(true);

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
          {nodes.length === 0 ? (
            <LandingHero />
          ) : (
            <Canvas />
          )}
        </Box>
      </Box>

      <Upload isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
      
      {isSidebarOpen && (
        <AnalysisSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}
    </Box>
  );
}
