"use client";

import React, { useState } from "react";
import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { ContentCopy as CopyIcon, Check as CheckIcon } from "@mui/icons-material";
import { Highlight, themes } from "prism-react-renderer";

/** Split AI output into prose and fenced code blocks. */
function parseMarkdown(text: string) {
  const blocks: Array<{ type: "text" | "code"; content: string; language?: string }> = [];
  const regex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }
    blocks.push({
      type: "code",
      language: match[1] || "typescript",
      content: match[2],
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    blocks.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  return blocks;
}

/** Render AI output: prose as text, fenced code blocks syntax-highlighted with a copy button. */
export default function MarkdownContent({ text }: { text: string }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const blocks = parseMarkdown(text);

  return (
    <>
      {blocks.map((block, idx) => {
        if (block.type === "code") {
          return (
            <Box
              key={idx}
              sx={{
                position: "relative",
                my: 2,
                borderRadius: 2,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  px: 2,
                  py: 0.75,
                  bgcolor: "rgba(255,255,255,0.04)",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6875rem", fontFamily: "monospace" }}>
                  {block.language || "code"}
                </Typography>
                <Tooltip title={copiedIndex === idx ? "Copied!" : "Copy code"}>
                  <IconButton
                    size="small"
                    onClick={() => handleCopyCode(block.content, idx)}
                    sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "white" } }}
                  >
                    {copiedIndex === idx ? (
                      <CheckIcon fontSize="inherit" sx={{ color: "success.main" }} />
                    ) : (
                      <CopyIcon fontSize="inherit" />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                sx={{
                  p: 2,
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  overflow: "auto",
                  bgcolor: "#0d1117",
                }}
              >
                <Highlight
                  theme={themes.vsDark}
                  code={block.content.trim()}
                  language={block.language || "typescript"}
                >
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre className={className} style={{ ...style, margin: 0, background: "transparent" }}>
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
              </Box>
            </Box>
          );
        } else {
          return (
            <Typography
              key={idx}
              sx={{
                whiteSpace: "pre-wrap",
                fontSize: "0.8125rem",
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {block.content}
            </Typography>
          );
        }
      })}
    </>
  );
}
