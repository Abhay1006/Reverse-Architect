"use client";

import React from "react";
import { ThemeProvider as MUIThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const atlasTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#6366f1" },
    secondary: { main: "#a855f7" },
    error: { main: "#ef4444" },
    warning: { main: "#f59e0b" },
    info: { main: "#0ea5e9" },
    success: { main: "#22c55e" },
    background: {
      default: "#0a0a0c",
      paper: "#17171a",
    },
    text: {
      primary: "#f8fafc",
      secondary: "rgba(255,255,255,0.5)",
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
    h1: { fontWeight: 900, letterSpacing: "-0.02em" },
    h2: { fontWeight: 700, letterSpacing: "-0.01em" },
    h3: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 500, color: "rgba(255,255,255,0.5)" },
    subtitle2: {
      fontWeight: 600,
      fontSize: "0.625rem",
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      color: "rgba(255,255,255,0.3)",
    },
    button: { fontWeight: 700, letterSpacing: "0.04em" },
    caption: { fontSize: "0.625rem", fontWeight: 500, color: "rgba(255,255,255,0.3)" },
    overline: {
      fontWeight: 700,
      fontSize: "0.625rem",
      letterSpacing: "0.2em",
    },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { height: "100%" },
        body: {
          height: "100%",
          overflow: "hidden",
          background: "#0a0a0c",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 8,
          fontWeight: 700,
          fontSize: "0.6875rem",
        },
        sizeSmall: {
          height: 28,
          padding: "0 12px",
        },
      },
      defaultProps: {
        size: "small",
        disableElevation: true,
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          background: "rgba(15, 15, 20, 0.95)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          background: "linear-gradient(165deg, rgba(15,15,22,0.97) 0%, rgba(10,10,16,0.99) 100%)",
          backdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            background: "#0f0f12",
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(255,255,255,0.2)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "#6366f1",
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: "0.625rem",
          height: 22,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          background: "rgba(255,255,255,0.02)",
          border: "none",
          borderRadius: "8px !important",
          "&:before": { display: "none" },
          "&.Mui-expanded": { margin: 0 },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          minHeight: 40,
          padding: "0 10px",
          "&.Mui-expanded": { minHeight: 40 },
        },
        content: {
          margin: "8px 0",
          "&.Mui-expanded": { margin: "8px 0" },
        },
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: {
        separator: {
          color: "rgba(255,255,255,0.15)",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MUIThemeProvider theme={atlasTheme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </QueryClientProvider>
  );
}
