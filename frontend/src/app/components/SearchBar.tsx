"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAtlasStore } from "../store/atlas-store";

export default function SearchBar() {
  const { searchQuery, setSearchQuery, nodes, setSelectedNode } = useAtlasStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with global store changes (if any)
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    setSearchQuery(value); // Instantly filter canvas
    setShowResults(value.length > 0);
  };

  const handleSelectNode = (nodeId: string) => {
    setSelectedNode(nodeId);
    setShowResults(false);
  };

  // Fuzzy search simply checking if label contains query (case insensitive)
  const results = nodes.filter((n) => {
    const label = (n.data?.label as string) || n.id;
    return label.toLowerCase().includes(localQuery.toLowerCase());
  }).slice(0, 10); // Limit to top 10 results

  return (
    <div ref={containerRef} className="relative z-50 flex items-center justify-center pointer-events-auto">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={localQuery}
          onChange={handleChange}
          onFocus={() => { if (localQuery.length > 0) setShowResults(true); }}
          className="bg-[#17171a]/60 hover:bg-[#1a1b1e]/80 backdrop-blur-xl border border-white/10 text-white font-medium text-sm rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 block w-64 focus:w-80 pl-10 p-2.5 transition-all duration-500 ease-out shadow-lg focus:shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)] placeholder-white/30"
          placeholder="Search components..."
        />
        
        {/* Dropdown Results */}
        {showResults && results.length > 0 && (
          <div className="absolute top-14 left-0 w-full bg-black/80 backdrop-blur-3xl border border-white/20 rounded-xl shadow-[0_20px_60px_-10px_rgba(0,0,0,1)] ring-1 ring-white/10 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-300">
            {results.map((n) => {
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
                  className="w-full text-left px-4 py-3 group hover:bg-indigo-500/20 hover:pr-4 hover:pl-6 transition-all duration-300 flex items-center gap-3 border-l-2 border-transparent hover:border-indigo-500"
                >
                  <span className="w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] transition-all group-hover:scale-125" style={{ backgroundColor: typeColor, color: typeColor }}></span>
                  <span className="text-sm font-medium text-white/70 group-hover:text-white truncate transition-colors">{label}</span>
                  <span className="text-[10px] text-white/30 group-hover:text-indigo-300 font-bold uppercase tracking-wider ml-auto transition-colors">{n.type}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
