"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography, IconButton, Tooltip, CircularProgress } from "@mui/material";
import { Close as CloseIcon, ContentCopy as CopyIcon, Check as CheckIcon } from "@mui/icons-material";
import { useAtlasStore } from "../store/atlas-store";

export default function CodePeekPanel() {
  const { codePeekFile, setCodePeekFile, activeRepoId } = useAtlasStore();
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!codePeekFile || !activeRepoId) return;

    setLoading(true);
    setError(null);
    setCode("");

    const fetchCode = async () => {
      try {
        const url = `/api/code?repoId=${encodeURIComponent(activeRepoId)}&filePath=${encodeURIComponent(codePeekFile.filePath)}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to load file (${res.status})`);
        }
        const data = await res.json();
        setCode(data.code || "");
      } catch (err: any) {
        console.error(err);
        setError(err.message || "An error occurred while loading the file.");
      } finally {
        setLoading(false);
      }
    };

    fetchCode();
  }, [codePeekFile, activeRepoId]);

  if (!codePeekFile) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightCode = (rawCode: string) => {
    if (!rawCode) return "";
    
    // Escape HTML to prevent injection
    let escaped = rawCode
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Temporarily replace strings to avoid coloring keywords inside strings
    const strings: string[] = [];
    escaped = escaped.replace(/(["'`])(.*?)\1/g, (match) => {
      strings.push(match);
      return `___STR_PLACEHOLDER_${strings.length - 1}___`;
    });

    // Temporarily replace comments to avoid coloring keywords inside comments
    const comments: string[] = [];
    escaped = escaped.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, (match) => {
      comments.push(match);
      return `___COM_PLACEHOLDER_${comments.length - 1}___`;
    });

    // Highlight keywords
    const keywords = /\b(const|let|var|function|class|interface|import|export|from|return|if|else|for|while|do|switch|case|break|continue|default|new|this|typeof|instanceof|extends|implements|as|any|string|number|boolean|void|async|await|try|catch|finally|throw|type)\b/g;
    escaped = escaped.replace(keywords, '<span style="color: #ff7b72; font-weight: 600;">$1</span>');

    // Highlight function calls
    escaped = escaped.replace(/\b([a-zA-Z0-9_]+)(?=\()/g, '<span style="color: #d2a8ff;">$1</span>');

    // Highlight numbers
    escaped = escaped.replace(/\b(\d+)\b/g, '<span style="color: #79c0ff;">$1</span>');

    // Restore strings
    escaped = escaped.replace(/___STR_PLACEHOLDER_(\d+)___/g, (_, index) => {
      const str = strings[parseInt(index, 10)] || "";
      return `<span style="color: #a5d6ff;">${str}</span>`;
    });

    // Restore comments
    escaped = escaped.replace(/___COM_PLACEHOLDER_(\d+)___/g, (_, index) => {
      const com = comments[parseInt(index, 10)] || "";
      return `<span style="color: #8b949e; font-style: italic;">${com}</span>`;
    });

    return escaped;
  };

  const codeLines = code.split("\n");
  const highlightedHtml = highlightCode(code);

  return (
    <Box
      sx={{
        position: "fixed",
        right: 0,
        top: 0,
        width: 580,
        height: "100vh",
        bgcolor: "rgba(10, 10, 12, 0.85)",
        backdropFilter: "blur(20px)",
        borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "-10px 0 40px rgba(0, 0, 0, 0.6)",
        zIndex: 1050,
        display: "flex",
        flexDirection: "column",
        animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "@keyframes slideIn": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <Box sx={{ minWidth: 0, mr: 2 }}>
          <Typography sx={{ color: "white", fontSize: "0.875rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {codePeekFile.label}
          </Typography>
          <Typography sx={{ color: "rgba(255, 255, 255, 0.4)", fontSize: "0.6875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={codePeekFile.filePath}>
            {codePeekFile.filePath}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {code && (
            <Tooltip title={copied ? "Copied!" : "Copy code"}>
              <IconButton onClick={handleCopy} size="small" sx={{ color: "rgba(255,255,255,0.6)", "&:hover": { bgcolor: "rgba(255,255,255,0.06)", color: "white" } }}>
                {copied ? <CheckIcon fontSize="small" sx={{ color: "success.main" }} /> : <CopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={() => setCodePeekFile(null)} size="small" sx={{ color: "rgba(255,255,255,0.6)", "&:hover": { bgcolor: "rgba(255,255,255,0.06)", color: "white" } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Code Display Area */}
      <Box sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", p: 0 }}>
        {loading ? (
          <Box sx={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
            <CircularProgress size={24} sx={{ color: "primary.main" }} />
            <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>
              Reading source file...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", p: 4, gap: 1.5, textAlign: "center" }}>
            <Typography sx={{ color: "error.light", fontSize: "0.875rem", fontWeight: 600 }}>
              Error Peeking Code
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", maxWidth: 400 }}>
              {error}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "flex",
              fontFamily: "'Fira Code', 'Courier New', Courier, monospace",
              fontSize: "0.75rem",
              lineHeight: 1.6,
              color: "#e6edf3",
              minHeight: "100%",
              bgcolor: "#0d1117",
              p: 2,
            }}
          >
            {/* Line Numbers Column */}
            <Box
              sx={{
                userSelect: "none",
                textAlign: "right",
                color: "#30363d",
                pr: 2.5,
                borderRight: "1px solid #21262d",
                mr: 2.5,
                flexShrink: 0,
              }}
            >
              {codeLines.map((_, index) => (
                <div key={index}>{index + 1}</div>
              ))}
            </Box>

            {/* Code Text Column */}
            <Box
              component="pre"
              sx={{
                m: 0,
                flex: 1,
                overflowX: "auto",
                whiteSpace: "pre",
              }}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
