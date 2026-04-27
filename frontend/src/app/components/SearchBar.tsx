"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search } from "lucide-react";
import { useAtlasStore } from "../store/atlas-store";

export default function SearchBar() {
  const { searchQuery, setSearchQuery, nodes, setSelectedNode, panToNode } = useAtlasStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showResults, setShowResults] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!localQuery) return [];
    const q = localQuery.toLowerCase();
    return nodes
      .filter((n) => {
        const label = ((n.data?.label as string) || "").toLowerCase();
        const id = n.id.toLowerCase();
        const path = ((n.data?.filePath as string) || "").toLowerCase();
        
        return label.includes(q) || id.includes(q) || path.includes(q);
      })
      .sort((a, b) => {
        // Priority: exact label match > label starts with > path contains
        const aLabel = ((a.data?.label as string) || "").toLowerCase();
        const bLabel = ((b.data?.label as string) || "").toLowerCase();
        
        if (aLabel === q) return -1;
        if (bLabel === q) return 1;
        if (aLabel.startsWith(q) && !bLabel.startsWith(q)) return -1;
        if (!aLabel.startsWith(q) && bLabel.startsWith(q)) return 1;
        return 0;
      })
      .slice(0, 10);
  }, [nodes, localQuery]);

  // Toggle on Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
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
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setSearchQuery]);

  // Handle keyboard navigation for results
  useEffect(() => {
    if (!isOpen || !showResults) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectNode(results[selectedIndex].id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showResults, selectedIndex, results]);

  // Focus input automatically when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    setSearchQuery(value); // Instantly filter canvas
    setShowResults(value.length > 0);
    setSelectedIndex(0); // Reset selection on search
  };

  const handleSelectNode = (nodeId: string) => {
    panToNode(nodeId);
    setIsOpen(false);
    setLocalQuery("");
    setSearchQuery("");
  };

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="app-btn app-btn--ghost group"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
          <span className="opacity-70 group-hover:opacity-100 transition-opacity">Search</span>
        </div>
        <div className="flex items-center gap-1 ml-1 opacity-30 group-hover:opacity-60 transition-opacity">
          <span className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-bold">⌘K</span>
        </div>
      </button>

      {/* Spotlight Modal */}
      {isOpen && (
        <div className="spotlight-backdrop" onClick={() => setIsOpen(false)}>
          <div
            ref={containerRef}
            className="spotlight-container"
            onClick={e => e.stopPropagation()}
          >
            <div className="spotlight-input-area">
              <Search className="h-5 w-5 text-white/40 mr-5" />
              <input
                ref={inputRef}
                type="text"
                value={localQuery}
                onChange={handleChange}
                className="spotlight-input"
                placeholder="Spotlight Search"
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            {/* Results */}
            {showResults && (
              <div className="spotlight-results">
                <div className="spotlight-section-title">Architecture Nodes</div>
                {results.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-white/40 text-sm">No results for &quot;{localQuery}&quot;</p>
                  </div>
                ) : (
                  results.map((n, index) => {
                    const label = (n.data?.label as string) || n.id;
                    const isSelected = index === selectedIndex;
                    const typeColor =
                      n.type === 'class' ? 'var(--class-bg)' :
                        n.type === 'interface' ? 'var(--interface-bg)' :
                          n.type === 'function' ? 'var(--function-bg)' :
                            'var(--file-bg)';

                    return (
                      <button
                        key={n.id}
                        onClick={() => handleSelectNode(n.id)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`spotlight-result-item ${isSelected ? 'spotlight-result-item--selected' : ''}`}
                      >
                        <div className="spotlight-result-icon">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: typeColor }}></div>
                        </div>

                        <div className="spotlight-result-content">
                          <span className="spotlight-result-label">{label}</span>
                          <span className="spotlight-result-sublabel">{n.type?.toUpperCase()} Node</span>
                        </div>

                        {isSelected && (
                          <div className="ml-auto text-white/50 text-[10px] font-bold pr-2">
                            ↵
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Footer */}
            {!showResults && (
              <div className="spotlight-footer">
                <div className="flex gap-4">
                  <div className="flex items-center gap-1">
                    <span className="spotlight-key">↑↓</span>
                    <span>Navigate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="spotlight-key">↵</span>
                    <span>Open</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="spotlight-key">ESC</span>
                    <span>Close</span>
                  </div>
                </div>
                <div className="italic opacity-50">Atlas Search</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
