# 🏛️ Atlas-TS

**Atlas-TS** is an intelligent, automated Architecture Visualization and AI Analysis tool for modern TypeScript and JavaScript codebases. 

Instead of reading thousands of lines of raw code to deduce interactions, Atlas-TS parses your repository, extracts its entities (Classes, Interfaces, Functions), computes relationships, detects anti-patterns (God Objects, Circular Dependencies, Dead Code), identifies architectural designs (Factories, Observers, Singletons), and renders it all in an interactive, sleek, animated node map.

## ✨ Features

- 🔭 **Interactive Graph Mapping**: Drag, pan, and zoom through beautiful, color-coded node graphs mapped automatically by React Flow and Dagre algorithms.
- ⚡ **Real-Time Search & Highlight**: Instantly focus on complex interactions out of thousands with a fuzzy search dropdown that elegantly dims non-matching entities.
- 🐙 **1-Click GitHub Loading**: Pull and visualize any public (or private) GitHub repository simply by pasting its URL directly into the engine, powered by `simple-git`.
- 🕵️ **Heuristic Design Pattern Inference**: Automatically badges components with pattern detections like **Singleton**, **Factory**, or **Observer** layouts.
- 🚨 **Issue & Anti-Pattern Detection**: Instantly warns you about God Objects (over-bloated components), Circular Dependencies (highlighted dynamically in red), and potentially Dead / Unused Code snippets.
- 📁 **Zero-Configuration Zip Uploads**: Drag and drop arbitrary codebase .zip files directly onto the browser canvas; Multer and Express handles the rapid extraction securely.

## 🚀 Getting Started

Atlas-TS uses a powerful monorepo architecture divided between a high-speed Express/TypeScript backend running `ts-morph` and a React+Next.js frontend.

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
The sleek UI dashboard built using Next.js 14 and Tailwind CSS.
```bash
cd frontend
npm install
npm run dev
```
*The Web App will ignite on `http://localhost:3000`*

## 📚 Core API Reference

The backend operates over a rapid REST architecture:

- `GET /api/health`: Validates server allocation and rate-limit availability.
- `POST /api/analyze/upload`: Accepts `multipart/form-data` containing a .zip repository. Automatically scales into the provided temporary container for heuristic mappings. *(Limited to 50MB; 30req/hr).*
- `POST /api/analyze/github`: Provide JSON `{ "url": "https://github.com/user/repo" }`. The server clones the repository `--depth 1` instantly, evaluates it, and drops the clone to preserve local disk space.

## 🤝 Contributing
Contributions are absolutely welcome to help push Node/AST visualization bounds.

1. **Fork the repo** and clone it locally.
2. **Create a feature branch** (`git checkout -b feature/EpicVisualization`).
3. **Commit your changes** (`git commit -m 'Added incredible new design pattern inference'`).
4. **Push to the branch** (`git push origin feature/EpicVisualization`).
5. **Open a Pull Request**! Ensure both frontend UI adjustments and backend parser updates match existing architectural styling in `globals.css` and `types.ts`!

## 📜 License
Atlas-TS is completely open-source and free to utilize. Go untangle those codebases!
