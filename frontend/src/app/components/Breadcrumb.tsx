"use client";

import React from "react";
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
        <svg className="bc-home-icon" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
        <span>Root</span>
      </button>

      {segments.map((seg, i) => {
        const path = segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;

        return (
          <React.Fragment key={path}>
            <span className="bc-separator">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
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
