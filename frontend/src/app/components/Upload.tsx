"use client";

import React, { useState, useRef } from "react";
import { useAtlasStore } from "../store/atlas-store";

interface UploadProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Upload({ isOpen, onClose }: UploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const setGraph = useAtlasStore((state) => state.setGraph);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload a .zip file.");
      return;
    }
    setError(null);
    simulateAnalysis(file.name);
  };

  const handleAnalyzeUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) {
      setError("Please enter a GitHub URL.");
      return;
    }
    if (!githubUrl.includes("github.com")) {
      setError("Invalid GitHub URL.");
      return;
    }
    setError(null);
    simulateAnalysis(githubUrl);
  };

  const simulateAnalysis = (source: string) => {
    setIsAnalyzing(true);
    
    // Simulating analysis delay
    setTimeout(() => {
      // Mock data representing the "analyzed" project
      const mockNodes = [
        {
          id: "n1",
          type: "class",
          position: { x: 250, y: 150 },
          data: {
            label: "AppController",
            filePath: "src/controller.ts",
            metadata: { properties: ["service: AppService"], methods: ["index()"], lineCount: 120 }
          }
        },
        {
          id: "n2",
          type: "class",
          position: { x: 450, y: 350 },
          data: {
            label: "AppService",
            filePath: "src/service.ts",
            metadata: { properties: ["repository: DB"], methods: ["getData()"], lineCount: 200 }
          }
        }
      ];

      const mockEdges = [
        { id: "e1-2", source: "n1", target: "n2", animated: true, label: "injects" }
      ];

      const mockAnalysis = {
        godObjects: [],
        deadCode: [],
        cycles: [],
        patterns: []
      };

      setGraph(mockNodes as any, mockEdges as any, mockAnalysis as any);
      setIsAnalyzing(false);
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-lg overflow-hidden bg-[var(--glass-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Analyze Project</h2>
          <p className="text-white/50 text-sm">Upload a repository or provide a GitHub URL to start the visualization.</p>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 space-y-6">
          {/* Progress / Spinner Overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[var(--glass-bg)] backdrop-blur-md space-y-4">
              <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <p className="text-white font-medium">Analyzing architecture...</p>
                <p className="text-white/40 text-xs">Extracting patterns and dependencies</p>
              </div>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative group cursor-pointer border-2 border-dashed rounded-xl p-10 transition-all duration-300
              ${isDragging 
                ? "border-[var(--primary)] bg-[var(--primary-glow)]" 
                : "border-white/10 hover:border-white/20 hover:bg-white/5"}
            `}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".zip"
              onChange={(e) => e.target.files && handleFileSelected(e.target.files[0])}
            />
            
            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`p-3 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors ${isDragging ? "text-[var(--primary)]" : "text-white/40"}`}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Drop .zip project here</p>
                <p className="text-white/30 text-xs">or click to browse local files</p>
              </div>
            </div>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-white/20 text-[10px] font-bold uppercase tracking-widest">OR</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          {/* GitHub URL Input */}
          <form onSubmit={handleAnalyzeUrl} className="space-y-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-white/30">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="https://github.com/username/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all"
              />
            </div>
            
            <button 
              type="submit"
              className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[var(--primary-glow)] active:scale-[0.98]"
            >
              Analyze GitHub Repository
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-in slide-in-from-top-2 duration-200">
              <p className="text-red-400 text-xs text-center">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white/5 px-8 py-4 flex justify-between items-center text-[10px] text-white/30 font-bold uppercase tracking-widest">
          <span>Supported: TypeScript, JavaScript</span>
          <button 
            onClick={onClose}
            className="hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
