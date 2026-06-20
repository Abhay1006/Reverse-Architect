"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography, IconButton, Tooltip, CircularProgress } from "@mui/material";
import { Close as CloseIcon, ContentCopy as CopyIcon, Check as CheckIcon } from "@mui/icons-material";
import { useAtlasStore } from "../store/atlas-store";
import { Highlight, themes } from "prism-react-renderer";

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

  // Close on Escape key
  useEffect(() => {
    if (!codePeekFile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCodePeekFile(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [codePeekFile, setCodePeekFile]);

  if (!codePeekFile) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (!ext) return 'javascript';
    switch (ext) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'tsx';
      case 'py':
        return 'python';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'java':
        return 'java';
      case 'kt':
      case 'kts':
        return 'kotlin';
      case 'swift':
        return 'swift';
      case 'c':
      case 'h':
        return 'c';
      case 'cpp':
      case 'hpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'cs':
        return 'csharp';
      case 'rb':
        return 'ruby';
      case 'php':
        return 'php';
      case 'sql':
        return 'sql';
      case 'prisma':
        return 'prisma';
      default:
        return 'clike';
    }
  };

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
            <Highlight
              theme={themes.vsDark}
              code={code}
              language={getLanguage(codePeekFile.filePath)}
            >
              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <Box
                  component="pre"
                  className={className}
                  style={{ ...style, background: "transparent", margin: 0, padding: 0 }}
                  sx={{
                    flex: 1,
                    overflowX: "auto",
                    whiteSpace: "pre",
                    display: "flex",
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
                    {tokens.map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </Box>

                  {/* Code Lines */}
                  <Box sx={{ flex: 1, overflowX: "auto" }}>
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })}>
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </div>
                    ))}
                  </Box>
                </Box>
              )}
            </Highlight>
          </Box>
        )}
      </Box>
    </Box>
  );
}
