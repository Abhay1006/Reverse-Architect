"use client";

import React from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Avatar,
} from "@mui/material";
import { VpnKey as KeyIcon } from "@mui/icons-material";
import type { AiProvider } from "./types";

interface AiKeySetupProps {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  provider: AiProvider;
  onProviderChange: (value: AiProvider) => void;
  onSave: () => void;
}

/** Shown until the user has entered an API key for this session. */
export default function AiKeySetup({ apiKey, onApiKeyChange, provider, onProviderChange, onSave }: AiKeySetupProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        p: 4,
        bgcolor: "#0a0a0c",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 500,
          p: 4,
          borderRadius: 3,
          bgcolor: "rgba(25, 25, 30, 0.6)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Avatar sx={{ bgcolor: "info.main", width: 56, height: 56 }}>
            <KeyIcon sx={{ fontSize: 28, color: "black" }} />
          </Avatar>
        </Box>

        <Box>
          <Typography variant="h6" sx={{ color: "white", fontWeight: 700, mb: 1 }}>
            Configure AI Key
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
            Provide your API key to enable Codebase Q&A Chat and automated Issue Fixing.
            Keys are stored <strong>only in this browser session</strong> (sessionStorage)
            and deleted automatically when you close the tab/window. They are never saved on the server.
          </Typography>
        </Box>

        <FormControl fullWidth variant="outlined" size="small">
          <InputLabel id="provider-select-label" sx={{ color: "rgba(255,255,255,0.6)" }}>AI Provider</InputLabel>
          <Select
            labelId="provider-select-label"
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as AiProvider)}
            label="AI Provider"
            sx={{
              color: "white",
              ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.15)" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "info.main" },
            }}
          >
            <MenuItem value="openai">OpenAI</MenuItem>
            <MenuItem value="anthropic">Anthropic (Claude)</MenuItem>
            <MenuItem value="gemini">Google Gemini</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          type="password"
          label="API Key"
          placeholder={`Enter your ${provider === 'openai' ? 'sk-...' : provider === 'anthropic' ? 'sk-ant-...' : 'Gemini API key'}`}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          size="small"
          InputLabelProps={{ style: { color: "rgba(255,255,255,0.6)" } }}
          inputProps={{ style: { color: "white" } }}
          sx={{
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
              "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
              "&.Mui-focused fieldset": { borderColor: "info.main" },
            },
          }}
        />

        <Button
          fullWidth
          variant="contained"
          disabled={!apiKey.trim()}
          onClick={onSave}
          sx={{
            bgcolor: "info.main",
            color: "black",
            fontWeight: 700,
            textTransform: "none",
            "&:hover": { bgcolor: "info.light" },
            "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" },
          }}
        >
          Start Q&A Session
        </Button>
      </Paper>
    </Box>
  );
}
