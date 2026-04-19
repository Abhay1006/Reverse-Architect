"use client";

import { useEffect, useState } from "react";
import Canvas from "./components/Canvas";
import Upload from "./components/Upload";
import AnalysisSidebar from "./components/AnalysisSidebar";
import SearchBar from "./components/SearchBar";
import { useAtlasStore } from "./store/atlas-store";
import { toPng } from "html-to-image";

export default function Home() {
  const setGraph = useAtlasStore((state) => state.setGraph);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    <main className="w-full h-screen overflow-hidden relative">
      {/* Header Overlay */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h1 className="text-2xl font-black tracking-tighter text-white/90">
          ATLAS<span className="text-primary italic">.TS</span>
        </h1>
        <p className="text-[10px] text-white/30 uppercase tracking-[0.2em]">Architecture Intelligence</p>
      </div>

      {/* Floating Toolbar */}
      <div className="absolute top-6 right-6 z-10 flex flex-wrap justify-end gap-2 items-center pointer-events-none max-w-[calc(100vw-3rem)]">
        <SearchBar />
        <button 
          onClick={handleExportPng}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-bold rounded-lg backdrop-blur-md transition-all pointer-events-auto"
        >
          EXPORT PNG
        </button>
        <button 
          onClick={() => setIsUploadOpen(true)}
          className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-white hover:text-white text-xs font-bold rounded-lg backdrop-blur-md transition-all pointer-events-auto shadow-[0_0_15px_rgba(99,102,241,0.2)]"
        >
          RE-ANALYZE
        </button>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-white hover:text-white text-xs font-bold rounded-lg backdrop-blur-md transition-all pointer-events-auto shadow-[0_0_15px_rgba(99,102,241,0.2)]"
        >
          ANALYSIS
        </button>
      </div>

      <Canvas />

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
