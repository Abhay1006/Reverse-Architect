"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAtlasStore } from "../store/atlas-store";

export default function SearchBar() {
  const { searchQuery, setSearchQuery, nodes, setSelectedNode } = useAtlasStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showResults, setShowResults] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle on Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => {
          if (!open) { /* clear search on open */ setLocalQuery(""); setSearchQuery(""); setShowResults(false); }
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
  };

  const handleSelectNode = (nodeId: string) => {
    setSelectedNode(nodeId);
    setIsOpen(false);
  };

  const results = nodes.filter((n) => {
    const label = (n.data?.label as string) || n.id;
    return label.toLowerCase().includes(localQuery.toLowerCase());
  }).slice(0, 10);

  return (
    <>
      {/* Search Trigger Button (Rendered in Header) */}
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[#17171a] hover:bg-[#1a1b1e] border border-white/10 text-white/60 hover:text-white text-xs font-bold rounded-lg transition-all pointer-events-auto hover:border-indigo-500/50 shadow-lg"
      >
        <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>SEARCH</span>
        <span className="ml-2 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-white/50 hidden md:block">⌘K</span>
      </button>

      {/* Spotlight Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 pointer-events-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
          <div 
            ref={containerRef} 
            className="w-full max-w-2xl bg-[#111114] border border-white/10 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in slide-in-from-top-4 duration-300 transform scale-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Massive Input Area */}
            <div className="flex items-center px-6 py-5 border-b border-white/5">
              <svg className="h-4 w-4 text-white/50 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={localQuery}
                onChange={handleChange}
                // Inline styles force text white and background dark to defeat autofill CSS overrides
                style={{ color: '#ffffff', backgroundColor: 'transparent' }}
                className="w-full bg-transparent text-white text-xl placeholder-white/30 outline-none border-none focus:ring-0 appearance-none"
                placeholder="Search architecture components..."
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            
            {/* Dropdown Results */}
            {showResults && (
              <div className="max-h-[50vh] overflow-y-auto bg-[#0a0a0c]/50 p-2">
                {results.length === 0 ? (
                  <p className="text-center text-white/40 py-8 text-sm">No results found.</p>
                ) : (
                  results.map((n) => {
                    const label = (n.data?.label as string) || n.id;
                    const typeColor = 
                      n.type === 'class' ? 'var(--class-bg)' :
                      n.type === 'interface' ? 'var(--interface-bg)' :
                      n.type === 'function' ? 'var(--function-bg)' : 
                      'var(--file-bg)';
                    
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleSelectNode(n.id)}
                        className="w-full text-left px-4 py-4 rounded-xl group hover:bg-indigo-600/20 hover:pl-6 transition-all duration-300 flex items-center gap-4 border border-transparent hover:border-indigo-500/30 mb-1"
                      >
                        <span className="w-3 h-3 rounded-md shadow-[0_0_12px_currentColor] transition-all group-hover:scale-125" style={{ backgroundColor: typeColor, color: typeColor }}></span>
                        <span className="text-lg font-medium text-white/80 group-hover:text-white truncate transition-colors">{label}</span>
                        <span className="text-[11px] px-2 py-1 rounded bg-white/5 text-white/30 group-hover:text-indigo-200 group-hover:bg-indigo-500/20 font-bold uppercase tracking-wider ml-auto transition-colors border border-white/5">{n.type}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
            
            {/* Helper footer */}
            {!showResults && (
               <div className="px-6 py-4 bg-[#0a0a0c]/80 text-[11px] text-white/30 font-medium flex items-center gap-4 border-t border-white/5">
                 <span>Type to search architecture nodes...</span>
               </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
