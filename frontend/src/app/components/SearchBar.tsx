"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  Box,
  Typography,
  InputBase,
  List,
  ListItemButton,
  Chip,
  Button,
} from "@mui/material";
import { Search as SearchIcon } from "@mui/icons-material";
import { useAtlasStore } from "../store/atlas-store";

export default function SearchBar() {
  const { searchQuery, setSearchQuery, nodes, panToNode } = useAtlasStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showResults, setShowResults] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!localQuery) return [];
    const q = localQuery.toLowerCase();
    return nodes
      .filter((n) => {
        const label = ((n.data?.label as string) || "").toLowerCase();
        const id = n.id.toLowerCase();
        const path = ((n.data?.filePath as string) || "").toLowerCase();
        
        // Search inside methods and properties
        const methods = (n.data?.metadata?.methods || []).map(m => m.toLowerCase());
        const properties = (n.data?.metadata?.properties || []).map(p => p.toLowerCase());
        const hasSymbolMatch = methods.some(m => m.includes(q)) || properties.some(p => p.includes(q));

        return label.includes(q) || id.includes(q) || path.includes(q) || hasSymbolMatch;
      })
      .sort((a, b) => {
        const aLabel = ((a.data?.label as string) || "").toLowerCase();
        const bLabel = ((b.data?.label as string) || "").toLowerCase();

        // Priority: exact label match > label starts with > symbol match > path contains
        if (aLabel === q) return -1;
        if (bLabel === q) return 1;
        if (aLabel.startsWith(q) && !bLabel.startsWith(q)) return -1;
        if (!aLabel.startsWith(q) && bLabel.startsWith(q)) return 1;
        
        // Symbol match priority
        const aSymbols = [...(a.data?.metadata?.methods || []), ...(a.data?.metadata?.properties || [])].map(s => s.toLowerCase());
        const bSymbols = [...(b.data?.metadata?.methods || []), ...(b.data?.metadata?.properties || [])].map(s => s.toLowerCase());
        const aHasSymbol = aSymbols.some(s => s.includes(q));
        const bHasSymbol = bSymbols.some(s => s.includes(q));
        if (aHasSymbol && !bHasSymbol) return -1;
        if (!aHasSymbol && bHasSymbol) return 1;

        return 0;
      })
      .slice(0, 15);
  }, [nodes, localQuery]);

  // Toggle on Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => {
          if (!open) {
            setLocalQuery("");
            setSearchQuery("");
            setShowResults(false);
            setSelectedIndex(0);
          }
          return !open;
        });
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setSearchQuery]);

  const handleSelectNode = (nodeId: string) => {
    panToNode(nodeId);
    setIsOpen(false);
    setLocalQuery("");
    setSearchQuery("");
  };

  // Handle keyboard navigation for results
  useEffect(() => {
    if (!isOpen || !showResults) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = results[selectedIndex];
        if (target) {
          handleSelectNode(target.id);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // handleSelectNode is recreated each render but only reads store setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, showResults, selectedIndex, results]);

  // Focus input automatically when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    setSearchQuery(value); // Instantly filter canvas
    setShowResults(value.length > 0);
    setSelectedIndex(0); // Reset selection on search
  };

  const typeColorMap: Record<string, string> = {
    class: "var(--class-bg)",
    interface: "var(--interface-bg)",
    function: "var(--function-bg)",
    file: "var(--file-bg)",
    database: "#10b981",
  };

  return (
    <>
      {/* Search Trigger Button */}
      <Button
        onClick={() => setIsOpen(true)}
        size="small"
        variant="outlined"
        startIcon={<SearchIcon sx={{ fontSize: 14, opacity: 0.5 }} />}
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
        Search
        <Chip
          label="⌘K"
          size="small"
          sx={{
            ml: 0.5,
            height: 18,
            fontSize: "0.5625rem",
            fontWeight: 700,
            bgcolor: "rgba(255,255,255,0.08)",
            color: "text.secondary",
          }}
        />
      </Button>

      {/* Spotlight Modal */}
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: "blur(8px)",
              background: "rgba(0,0,0,0.4)",
            },
          },
        }}
        PaperProps={{
          sx: {
            mt: "15vh",
            alignSelf: "flex-start",
            background: "rgba(30,30,35,0.8)",
            backdropFilter: "blur(50px) saturate(210%)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 4.5,
            boxShadow:
              "0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)",
            overflow: "hidden",
          },
        }}
      >
        {/* Input Area */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 3.5,
            py: 2.75,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <SearchIcon sx={{ fontSize: 20, color: "rgba(255,255,255,0.4)", mr: 2 }} />
          <InputBase
            inputRef={inputRef}
            value={localQuery}
            onChange={handleChange}
            placeholder="Search symbols, files..."
            autoComplete="off"
            spellCheck="false"
            fullWidth
            sx={{
              fontSize: 28,
              fontWeight: 300,
              letterSpacing: "-0.02em",
              color: "white",
              "& input::placeholder": {
                color: "rgba(255,255,255,0.25)",
                opacity: 1,
              },
            }}
          />
        </Box>

        {/* Results */}
        {showResults && (
          <Box sx={{ maxHeight: 420, overflowY: "auto", p: 1 }}>
            <Typography
              sx={{
                px: 1.5,
                pt: 1,
                pb: 0.5,
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Architecture Nodes
            </Typography>
            {results.length === 0 ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.875rem" }}>
                  No results for &quot;{localQuery}&quot;
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {results.map((n, index) => {
                  const label = (n.data?.label as string) || n.id;
                  const isSelected = index === selectedIndex;
                  const typeColor = typeColorMap[n.type || "file"] || "var(--file-bg)";

                  return (
                    <ListItemButton
                      key={n.id}
                      onClick={() => handleSelectNode(n.id)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      selected={isSelected}
                      sx={{
                        borderRadius: 2.5,
                        py: 1,
                        px: 1.5,
                        gap: 1.5,
                        "&.Mui-selected": {
                          background: "var(--primary)",
                          boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
                          "&:hover": {
                            background: "var(--primary)",
                          },
                        },
                      }}
                    >
                      {/* Type indicator */}
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          background: isSelected
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(255,255,255,0.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: 0.5,
                            background: typeColor,
                          }}
                        />
                      </Box>

                      {/* Content */}
                      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                        <Typography
                          sx={{
                            fontSize: 15,
                            fontWeight: 500,
                            color: isSelected ? "white" : "rgba(255,255,255,0.9)",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                          }}
                        >
                          {label}
                        </Typography>
                        
                        {/* Symbol Match Highlight */}
                        {(() => {
                          const q = localQuery.toLowerCase();
                          const matchingMethod = (n.data?.metadata?.methods || []).find(m => m.toLowerCase().includes(q));
                          const matchingProp = (n.data?.metadata?.properties || []).find(p => p.toLowerCase().includes(q));
                          const match = matchingMethod || matchingProp;
                          
                          if (match) {
                            return (
                              <Typography sx={{ fontSize: "0.6875rem", color: isSelected ? "rgba(255,255,255,0.9)" : "var(--primary)", fontWeight: 700 }}>
                                Match: <span style={{ opacity: 0.7 }}>{match}</span>
                              </Typography>
                            );
                          }
                          return (
                            <Typography
                              sx={{
                                fontSize: "0.6875rem",
                                color: isSelected
                                  ? "rgba(255,255,255,0.7)"
                                  : "rgba(255,255,255,0.35)",
                              }}
                            >
                              {n.type?.toUpperCase()} in {n.data?.filePath?.split('/').pop()}
                            </Typography>
                          );
                        })()}
                      </Box>

                      {isSelected && (
                        <Typography
                          sx={{
                            ml: "auto",
                            color: "rgba(255,255,255,0.5)",
                            fontSize: "0.625rem",
                            fontWeight: 700,
                            pr: 1,
                          }}
                        >
                          ↵
                        </Typography>
                      )}
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </Box>
        )}

        {/* Footer */}
        {!showResults && (
          <Box
            sx={{
              px: 2.5,
              py: 1.25,
              background: "rgba(255,255,255,0.02)",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.6875rem",
              color: "rgba(255,255,255,0.2)",
            }}
          >
            <Box sx={{ display: "flex", gap: 2 }}>
              {[
                { key: "↑↓", label: "Navigate" },
                { key: "↵", label: "Open" },
                { key: "ESC", label: "Close" },
              ].map(({ key, label }) => (
                <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Chip
                    label={key}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "0.5625rem",
                      fontWeight: 700,
                      bgcolor: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "inherit",
                    }}
                  />
                  <Typography sx={{ fontSize: "inherit" }}>{label}</Typography>
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontStyle: "italic", opacity: 0.5 }}>
              Search
            </Typography>
          </Box>
        )}
      </Dialog>
    </>
  );
}
