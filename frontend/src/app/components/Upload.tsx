"use client";

import React, { useState, useRef } from "react";
import { Upload as UploadIcon, GitBranch, Loader2 } from "lucide-react";
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
        <div className="px-8 pb-8 space-y-6">
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
                <UploadIcon className="w-8 h-8" />
              </div>
              <div>
                {isAnalyzing ? (
                  <div className="flex flex-col items-center space-y-2">
                    <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
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

          <div className="relative flex items-center pt-8 pb-2">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-white/20 text-[10px] font-bold uppercase tracking-[0.2em] leading-none">OR</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>
          
          {/* Explicit spacer to guarantee gap before input box */}
          <div className="h-4"></div>

          {/* GitHub URL Input Form */}
          <form onSubmit={handleAnalyzeUrl} className="flex flex-col" style={{ gap: "24px" }}>
            <div className="relative group">
              <input
                type="text"
                placeholder="https://github.com/username/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                style={{ backgroundColor: "#0f0f12", color: "#e2e2e2", caretColor: "#a5b4fc" }}
                className="w-full border border-white/10 rounded-xl py-4 px-5 text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] group-hover:border-white/20"
              />
              {/* Subtle inner glow for the input box */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-indigo-500/5 to-transparent pointer-events-none" />
            </div>

            <button
              type="submit"
              disabled={isAnalyzing || !githubUrl.trim()}
              className="group relative w-full overflow-hidden rounded-xl py-3.5 px-6 font-semibold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-3"
              style={{
                background: isAnalyzing || !githubUrl.trim()
                  ? "rgba(255,255,255,0.03)"
                  : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                color: isAnalyzing || !githubUrl.trim()
                  ? "rgba(255,255,255,0.2)"
                  : "#ffffff",
                border: isAnalyzing || !githubUrl.trim()
                  ? "1px solid rgba(255,255,255,0.05)"
                  : "1px solid rgba(129,140,248,0.3)",
                cursor: isAnalyzing || !githubUrl.trim() ? "not-allowed" : "pointer",
              }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#a5b4fc" }} />
                  <span style={{ color: "#c7d2fe" }}>Analyzing Repository...</span>
                </>
              ) : (
                <>
                  <GitBranch
                    className="w-4 h-4"
                    style={{ opacity: !githubUrl.trim() ? 0.2 : 1 }}
                  />
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
        <div className="bg-[#101014] px-8 py-4 flex justify-between items-center text-[10px] text-white/30 font-bold uppercase tracking-widest border-t border-white/5">
          <span>Supported: TypeScript, JavaScript</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/5 hover:border-white/20 text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
