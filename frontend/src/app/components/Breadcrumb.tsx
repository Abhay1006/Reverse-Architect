"use client";

import React from "react";
import { Home, ChevronRight } from "lucide-react";
import { useAtlasStore } from "../store/atlas-store";

export default function Breadcrumb() {
  const { focusPath, setFocusPath } = useAtlasStore();

  const segments = focusPath ? focusPath.split("/").filter(Boolean) : [];

  return (
    <nav className="bc-bar" aria-label="Breadcrumb navigation">
      <button
        className={`bc-segment ${!focusPath ? "bc-segment--active" : ""}`}
        onClick={() => setFocusPath("")}
      >
        <Home className="bc-home-icon" />
        <span>Root</span>
      </button>

      {segments.map((seg, i) => {
        const path = segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;

        return (
          <React.Fragment key={path}>
            <span className="bc-separator">
              <ChevronRight className="w-3 h-3" />
            </span>
            <button
              className={`bc-segment ${isLast ? "bc-segment--active" : ""}`}
              onClick={() => setFocusPath(path)}
            >
              <span>{seg}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
