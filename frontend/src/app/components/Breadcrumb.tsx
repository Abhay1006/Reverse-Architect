"use client";

import {
  Breadcrumbs,
  Button,
  Box,
} from "@mui/material";
import {
  Home as HomeIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import { useAtlasStore } from "../store/atlas-store";

export default function Breadcrumb() {
  const { focusPath, setFocusPath } = useAtlasStore();

  const segments = focusPath ? focusPath.split("/").filter(Boolean) : [];

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 2.5,
        py: 1,
        background: "rgba(12,12,15,0.6)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        flexShrink: 0,
        overflowX: "auto",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
      component="nav"
      aria-label="Breadcrumb navigation"
    >
      <Breadcrumbs
        separator={
          <ChevronRightIcon
            sx={{ fontSize: 14, color: "rgba(255,255,255,0.15)" }}
          />
        }
        sx={{
          "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" },
        }}
      >
        <Button
          onClick={() => setFocusPath("")}
          startIcon={<HomeIcon sx={{ fontSize: "13px !important" }} />}
          size="small"
          sx={{
            minWidth: 0,
            px: 1,
            py: 0.375,
            fontSize: "0.75rem",
            fontWeight: !focusPath ? 600 : 500,
            color: !focusPath
              ? "rgba(255,255,255,0.8)"
              : "rgba(255,255,255,0.35)",
            borderRadius: 1.5,
            textTransform: "none",
            whiteSpace: "nowrap",
            "&:hover": {
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.7)",
            },
          }}
        >
          Root
        </Button>

        {segments.map((seg, i) => {
          const path = segments.slice(0, i + 1).join("/");
          const isLast = i === segments.length - 1;

          return (
            <Button
              key={path}
              onClick={() => setFocusPath(path)}
              size="small"
              sx={{
                minWidth: 0,
                px: 1,
                py: 0.375,
                fontSize: "0.75rem",
                fontWeight: isLast ? 600 : 500,
                color: isLast
                  ? "rgba(255,255,255,0.8)"
                  : "rgba(255,255,255,0.35)",
                borderRadius: 1.5,
                textTransform: "none",
                whiteSpace: "nowrap",
                "&:hover": {
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.7)",
                },
              }}
            >
              {seg}
            </Button>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}
