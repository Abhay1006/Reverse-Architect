"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Canvas from "./components/Canvas";
import Upload from "./components/Upload";
import AnalysisSidebar from "./components/AnalysisSidebar";
import SearchBar from "./components/SearchBar";
import FolderTree from "./components/FolderTree";
import Breadcrumb from "./components/Breadcrumb";
import { useAtlasStore } from "./store/atlas-store";
import { toPng } from "html-to-image";

export default function Home() {
  const setGraph = useAtlasStore((state) => state.setGraph);
  const nodes = useAtlasStore((state) => state.nodes);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFolderTreeOpen, setIsFolderTreeOpen] = useState(true);

  // Initialize with Mock Data for demonstration
  useEffect(() => {
    const mockNodes = [
      {
        id: "1",
        type: "class",
        position: { x: 100, y: 100 },
        data: {
          label: "ProjectParser",
          filePath: "src/parser/project-parser.ts",
          metadata: {
            properties: ["project: Project", "options: ParserOptions"],
            methods: ["parseProject", "getSourceFiles"],
            lineCount: 250,
          },
        },
      },
      {
        id: "2",
        type: "class",
        position: { x: 500, y: 150 },
        data: {
          label: "ClassExtractor",
          filePath: "src/parser/extractors/class-extractor.ts",
          metadata: {
            properties: ["checker: TypeChecker"],
            methods: ["extract", "getProperties", "getMethods"],
            lineCount: 450,
          },
        },
      },
      {
        id: "3",
        type: "interface",
        position: { x: 300, y: 400 },
        data: {
          label: "ArchNode",
          filePath: "shared/types.ts",
          metadata: {
            properties: ["id: string", "label: string", "type: EntityKind"],
            methods: [],
            lineCount: 50,
          },
        },
      },
      {
        id: "4",
        type: "function",
        position: { x: 600, y: 450 },
        data: {
          label: "computeLayout",
          filePath: "src/graph/layout.ts",
          metadata: {
            lineCount: 120,
          },
        },
      },
    ];

    const mockEdges = [
      { id: "e1-2", source: "1", target: "2", animated: true, label: "uses" },
      { id: "e2-3", source: "2", target: "3", label: "implements" },
      { id: "e1-4", source: "1", target: "4", animated: true, label: "calls" },
    ];

    const mockAnalysis = {
      godObjects: ["2"], // ClassExtractor is a "god object" for demo
      deadCode: ["4"],   // computeLayout is "dead code" for demo
      cycles: [],
      patterns: [],
    };

    setGraph(mockNodes as any, mockEdges as any, mockAnalysis as any);
  }, [setGraph]);

  const handleExportPng = () => {
    const el = document.querySelector('.react-flow') as HTMLElement;
    if (!el) return;
    
    toPng(el, { 
      backgroundColor: '#0a0a0c',
      pixelRatio: 2, // High resolution output
    })
    .then((dataUrl) => {
      const a = document.createElement('a');
      a.setAttribute('download', `atlas-architecture-${Date.now()}.png`);
      a.setAttribute('href', dataUrl);
      a.click();
    })
    .catch((err) => {
      console.error("Failed to export image", err);
    });
  };

  return (
    <main className="app-layout">
      {/* ── Folder Tree Sidebar ── */}
      {isFolderTreeOpen && nodes.length > 0 && (
        <aside className="app-sidebar">
          <FolderTree />
        </aside>
      )}

      {/* ── Main Content ── */}
      <div className="app-main">
        {/* Header Bar */}
        <header className="app-header">
          <div className="app-header-left">
            {/* Sidebar toggle */}
            <button
              className="app-sidebar-toggle"
              onClick={() => setIsFolderTreeOpen(!isFolderTreeOpen)}
              title={isFolderTreeOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <Menu className="w-[18px] h-[18px]" />
            </button>

            <h1 className="app-logo">
              ATLAS<span className="app-logo-accent">.TS</span>
            </h1>
          </div>

          <div className="app-header-right">
            <SearchBar />
            <button 
              onClick={handleExportPng}
              className="app-btn app-btn--ghost"
            >
              EXPORT PNG
            </button>
            <button 
              onClick={() => setIsUploadOpen(true)}
              className="app-btn app-btn--primary"
            >
              RE-ANALYZE
            </button>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="app-btn app-btn--primary"
            >
              ANALYSIS
            </button>
          </div>
        </header>

        {/* Breadcrumb */}
        {nodes.length > 0 && <Breadcrumb />}

        {/* Canvas */}
        <div className="app-canvas">
          <Canvas />
        </div>
      </div>

      <Upload 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
      />

      <AnalysisSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </main>
  );
}
