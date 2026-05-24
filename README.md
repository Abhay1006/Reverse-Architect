# 🏛️ Atlas

**Atlas** is an intelligent, automated Architecture Visualization and AI Analysis tool for modern multi-language codebases. 

Instead of reading thousands of lines of raw code to deduce interactions, Atlas parses your repository, extracts its entities (Classes, Interfaces, Functions, Database Tables), computes relationships, detects anti-patterns (God Objects, Circular Dependencies, Dead Code), identifies architectural designs (Factories, Observers, Singletons), and renders it all in an interactive, sleek 2D canvas or a stunning 3D WebGL force-directed graph.

---

## ✨ Features

- 🌐 **3D Force-Directed Graph**: Seamlessly toggle between a standard 2D view and an interactive 3D WebGL canvas. Features animated directional particle flows, emissive glowing node highlights for entry points and God Objects, and manual camera focus-zoom controls.
- 🎨 **Multi-Language Brand Colorization**: Out-of-the-box support for JS/TS, Python, Go, Rust, Java, Kotlin, Swift, C/C++, C#, Ruby, PHP, SQL, and Prisma. Nodes are custom-badged by language type and dynamically color-coded matching their brand palettes (e.g. Go cyan, Rust red, Python blue).
- 🔍 **Interactive Code Peek**: Click any file, class, method, or database schema node to trigger a syntax-highlighted slide-out drawer showing its source code.
- 🔥 **Complexity Heatmaps**: Dynamically color-code nodes on the canvas based on their cyclomatic complexity (green/teal → orange/red).
- 📋 **Mermaid & JSON Exports**: Export your codebase's architectural relationships as Markdown-compatible Mermaid flowchart diagrams or download raw graph JSON structure files.
- 🚨 **Anti-Pattern Detection**: Instantly warns you about God Objects (bloated components), Circular Dependencies (highlighted dynamically in red), and potentially Dead / Unused Code.
- 🐙 **1-Click GitHub Loading**: Pull and visualize any public (or private) GitHub repository simply by pasting its URL directly into the engine, powered by `simple-git` and cached commit hashing.
- 📁 **Zero-Configuration Zip Uploads**: Drag and drop codebase `.zip` archives directly onto the canvas for secure backend extraction and visualization.

---

## 🚀 Getting Started

Atlas uses a monorepo architecture divided between a high-speed Express/TypeScript backend running an LSP (Language Server Protocol) indexer and falling back on text-based regex parsers, and a React+Next.js frontend.

### Prerequisites
- Node.js (v18+ recommended)
- `npm` or `yarn`

### 1. Run the Backend Server
The backend parses AST structures and manages rate-controlled external integrations.
```bash
cd backend
npm install
npm run dev
```
*The API will start on `http://localhost:4000`*

### 2. Run the Frontend App
The UI dashboard built using Next.js 16 and Vanilla CSS with glassmorphic elements.
```bash
cd frontend
npm install
npm run dev
```
*The Web App will run on `http://localhost:3000`*

---

## 📚 Core API Reference

The backend operates over a rapid REST architecture:

- `GET /api/health`: Validates server allocation and rate-limit availability.
- `POST /api/analyze/upload`: Accepts `multipart/form-data` containing a `.zip` repository. Automatically extracts and indexes the directory.
- `POST /api/analyze/github`: Provide JSON `{ "url": "https://github.com/user/repo" }`. Clones and indexes the repository.
- `GET /api/code`: Fetches the source code of a specific file inside a repository clone with directory traversal security checks.

---

## 🤝 Contributing
Contributions are absolutely welcome to help push codebase visualization bounds.

1. **Fork the repo** and clone it locally.
2. **Create a feature branch** (`git checkout -b feature/EpicVisualization`).
3. **Commit your changes** (`git commit -m 'Added incredible new design pattern inference'`).
4. **Push to the branch** (`git push origin feature/EpicVisualization`).
5. **Open a Pull Request**! Ensure both frontend UI adjustments and backend parser updates match existing architectural styling in `globals.css` and `types.ts`!

---

## 📜 License
Atlas is completely open-source and free to utilize. Go untangle those codebases!
