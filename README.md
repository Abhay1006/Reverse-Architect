# 🗺️ Atlas-TS

**Google Maps for your Source Code.**

Atlas-TS is a web application that analyzes TypeScript projects and generates live, interactive architecture diagrams with smart Low-Level Design (LLD) analysis. Upload a project or paste a GitHub link — Atlas-TS visualizes how your code is connected and highlights architectural issues automatically.

---

## ✨ Features

### 🔍 Interactive Architecture Graph
- Visualize your entire project as a **draggable, zoomable dependency graph**
- Each node displays the class/interface name, properties, and methods
- Color-coded edges for imports, extends, and implements relationships

### 🧠 Smart LLD Analysis

| Feature | What It Does |
|---------|-------------|
| 🔴 **God Object Detector** | Highlights files/classes with too many connections (violating Single Responsibility) |
| 🟡 **Design Pattern Inference** | Identifies Observer, Singleton, and Factory patterns in your code |
| 👻 **Dead Code Finder** | Fades out files that aren't imported by anything |
| 🔄 **Circular Dependency Detector** | Highlights import cycles with dashed red edges |
| 🔍 **Search & Highlight** | Search for any class/file and see its immediate connections |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                  FRONTEND (Next.js)                   │
│                                                       │
│  [ Upload/URL ]  [ React Flow Canvas ]  [ Analysis ]  │
│  [ Component  ]  [ (interactive)     ]  [ Sidebar  ]  │
│                         │                             │
│                   Zustand Store                       │
└─────────────────────────┼─────────────────────────────┘
                          │  REST API
┌─────────────────────────┼─────────────────────────────┐
│                  BACKEND (Node.js)                     │
│                                                        │
│  [ ts-morph    ]  [ Graph Builder ]  [ Analyzers     ] │
│  [ AST Parser  ]  [ (DFS/BFS)    ]  [ (God Object,  ] │
│  [             ]  [              ]  [  Patterns,    ] │
│  [             ]  [              ]  [  Dead Code)   ] │
└────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **Node.js** + **TypeScript** — Runtime & language
- **ts-morph** — AST parsing (wrapper over TypeScript Compiler API)
- **Express.js** — REST API server
- **dagre** — Automatic graph layout calculation

### Frontend
- **Next.js 15** — React framework with App Router
- **React Flow (XyFlow)** — Interactive graph visualization
- **Zustand** — Lightweight state management

### Shared
- **TypeScript interfaces** — Shared types between frontend and backend

---

## 📂 Project Structure

```
Reverse-Architect/
├── backend/              # Node.js + Express + ts-morph
│   └── src/
│       ├── parser/       # AST parsing with ts-morph
│       ├── graph/        # Graph building & algorithms
│       ├── analyzers/    # God object, dead code, patterns
│       └── api/          # Express routes
│
├── frontend/             # Next.js + React Flow
│   └── app/
│       ├── components/   # Canvas, Upload, Sidebar, Custom Nodes
│       ├── store/        # Zustand state management
│       ├── hooks/        # Custom React hooks
│       └── lib/          # API client & utilities
│
└── shared/               # Shared TypeScript types
    └── types.ts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v20 or higher
- **npm** v10 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/Reverse-Architect.git
cd Reverse-Architect

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running Locally

```bash
# Terminal 1 — Start the backend
cd backend
npm run dev

# Terminal 2 — Start the frontend
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze/upload` | Analyze an uploaded zip file |
| `POST` | `/api/analyze/github` | Analyze a GitHub repository URL |
| `GET` | `/api/analysis/:id` | Retrieve a cached analysis |
| `GET` | `/api/health` | Health check |

---

## 🧪 How It Works

1. **Upload** a TypeScript project (zip file or GitHub URL)
2. **Parse** — ts-morph reads every `.ts`/`.tsx` file and builds an Abstract Syntax Tree
3. **Graph** — A directed graph is constructed from import relationships using DFS
4. **Analyze** — Detectors scan for god objects, dead code, circular dependencies, and design patterns
5. **Layout** — dagre calculates optimal node positions
6. **Render** — React Flow displays the interactive graph with custom nodes

---

## 🎯 Use Cases

- **Onboarding** — New developers can visually explore an unfamiliar codebase
- **Code Reviews** — See how a PR changes the architecture at a glance
- **Refactoring** — Identify god objects and circular dependencies before they become tech debt
- **Documentation** — Export architecture diagrams as PNG/SVG

---

## 🗺️ Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Parser | 🔧 In Progress | AST extraction with ts-morph |
| Phase 2: Graph | ⏳ Planned | Directed graph + cycle detection |
| Phase 3: Canvas | ⏳ Planned | React Flow interactive visualization |
| Phase 4: Analysis | ⏳ Planned | God objects, patterns, dead code |
| Phase 5: Polish | ⏳ Planned | GitHub integration, export, dark mode |

---

## 🤝 Contributing

Contributions are welcome! Please read the contributing guide before submitting a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License.

---

**Built with ❤️ by Abhay**
