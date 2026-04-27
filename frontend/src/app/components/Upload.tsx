"use client";

import React, { useState, useRef } from "react";
import { useAtlasStore } from "../store/atlas-store";
import {
  analyzeUpload,
  analyzeGithub,
  toStoreGraph,
  AtlasApiError,
} from "../lib/atlas-api";

interface UploadProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Upload({ isOpen, onClose }: UploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setGraph = useAtlasStore((state) => state.setGraph);

  if (!isOpen) return null;

  // ── Drag & Drop handlers ──────────────────────────────────────────────

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

  // ── File validation ───────────────────────────────────────────────────

  const handleFileSelected = (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload a .zip file.");
      return;
    }
    setError(null);
    setSelectedFile(file);
    runUploadAnalysis(file);
  };

  // ── GitHub URL submission ─────────────────────────────────────────────

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
    runGithubAnalysis(githubUrl);
  };

  // ── Real API integration ──────────────────────────────────────────────

  const runUploadAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const graph = await analyzeUpload(file);
      const { nodes, edges, analysis, godObjectDetails, deadCodeDetails, entryPoint } = toStoreGraph(graph);
      setGraph(nodes, edges, analysis, godObjectDetails, deadCodeDetails, entryPoint);
      onClose();
    } catch (err) {
      if (err instanceof AtlasApiError) {
        setError(err.details ? `${err.message}: ${err.details}` : err.message);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during upload analysis.",
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runGithubAnalysis = async (url: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const graph = await analyzeGithub(url);
      const { nodes, edges, analysis, godObjectDetails, deadCodeDetails, entryPoint } = toStoreGraph(graph);
      setGraph(nodes, edges, analysis, godObjectDetails, deadCodeDetails, entryPoint);
      onClose();
    } catch (err) {
      if (err instanceof AtlasApiError) {
        setError(err.details ? `${err.message}: ${err.details}` : err.message);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during GitHub analysis.",
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden bg-[var(--glass-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-4">Analyze Project</h2>
          <p className="text-white/50 text-sm">Upload a repository or provide a GitHub URL to start the visualization.</p>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 space-y-8">
          {/* Progress / Spinner Overlay */}
          {/* Progress / Spinner Overlay Removed - Using inline button loaders instead */}

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
                {isAnalyzing ? (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-white font-medium">Analyzing project...</p>
                  </div>
                ) : selectedFile ? (
                  <>
                    <p className="text-white font-medium">{selectedFile.name}</p>
                    <p className="text-white/30 text-xs">
                      {(selectedFile.size / 1024).toFixed(1)} KB — click to change
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-white font-medium">Drop .zip project here</p>
                    <p className="text-white/30 text-xs">or click to browse local files</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex items-center py-6">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-white/20 text-[10px] font-bold uppercase tracking-widest leading-none">OR</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          {/* GitHub URL Input */}
          <form onSubmit={handleAnalyzeUrl} className="space-y-5">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-white/40 group-focus-within:text-white transition-colors duration-300">
                <svg className="w-5 h-5 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="https://github.com/username/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                style={{ backgroundColor: "#17171a", color: "#ffffff" }}
                className="w-full border border-white/20 rounded-xl py-3 pl-11 pr-4 font-medium text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isAnalyzing || !githubUrl.trim()}
              className={`w-full relative overflow-hidden font-extrabold tracking-wide flex flex-row items-center justify-center gap-3 py-3.5 rounded-xl transition-all duration-500 border active:scale-[0.98]
                ${isAnalyzing || !githubUrl.trim()
                  ? "bg-white/5 text-white/30 border-white/5 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 text-white border-indigo-400/50 hover:border-indigo-300 hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:-translate-y-0.5"
                }
              `}
            >
              {/* Optional inner shine effect when button is active */}
              {!(isAnalyzing || !githubUrl.trim()) && (
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10 pointer-events-none rounded-xl" />
              )}

              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="opacity-80">Analyzing Repository...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-black opacity-90 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.022A9.607 9.607 0 0112 6.82c.85.004 1.705.114 2.504.336 1.909-1.29 2.747-1.022 2.747-1.022.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  <span>Analyze GitHub Repository</span>
                </>
              )}
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
        <div className="bg-[#101014] px-8 py-8 flex justify-between items-center text-[10px] text-white/30 font-bold uppercase tracking-widest border-t border-white/5">
          <span>Supported: TypeScript, JavaScript</span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/5 hover:border-white/20 shadow-md"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
