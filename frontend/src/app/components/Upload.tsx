"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Chip,
} from "@mui/material";
import {
  CloudUpload as UploadIcon,
  GitHub as GitHubIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useUploadAnalysis, useGithubAnalysis, getAnalysisErrorMessage } from "../hooks/useAnalysis";

interface UploadProps {
  isOpen: boolean;
  onClose: () => void;
}

const githubUrlSchema = Yup.object({
  githubUrl: Yup.string()
    .url("Please enter a valid URL")
    .matches(
      /github\.com\/[\w.-]+\/[\w.-]+/,
      "Must be a valid GitHub repository URL (e.g. https://github.com/user/repo)"
    )
    .required("GitHub URL is required"),
});

export default function Upload({ isOpen, onClose }: UploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadAnalysis();
  const githubMutation = useGithubAnalysis();

  const isAnalyzing = uploadMutation.isPending || githubMutation.isPending;

  // Formik for GitHub URL form
  const formik = useFormik({
    initialValues: { githubUrl: "" },
    validationSchema: githubUrlSchema,
    onSubmit: (values) => {
      setFileError(null);
      githubMutation.mutate(values.githubUrl, {
        onSuccess: () => {
          formik.resetForm();
          onClose();
        },
      });
    },
  });

  // ── Drag & Drop handlers ──────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  // ── File validation ───────────────────────────────────────────────────

  const handleFileSelected = (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setFileError("Please upload a .zip file.");
      return;
    }
    setFileError(null);
    setSelectedFile(file);
    uploadMutation.mutate(file, {
      onSuccess: () => {
        setSelectedFile(null);
        onClose();
      },
    });
  };

  const errorMessage =
    fileError ||
    (uploadMutation.isError
      ? getAnalysisErrorMessage(uploadMutation.error)
      : null) ||
    (githubMutation.isError
      ? getAnalysisErrorMessage(githubMutation.error)
      : null);

  return (
    <Dialog
      open={isOpen}
      onClose={isAnalyzing ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: {
          sx: { backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.6)" },
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 0.5,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontSize: "1.25rem", letterSpacing: "-0.01em" }}>
            Analyze Project
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
            Upload a repository or provide a GitHub URL to start visualization
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={isAnalyzing} size="small" sx={{ color: "text.secondary" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ pt: 2 }}>
        {/* Drag & Drop Zone */}
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isAnalyzing && fileInputRef.current?.click()}
          sx={{
            position: "relative",
            cursor: isAnalyzing ? "default" : "pointer",
            border: "2px dashed",
            borderColor: isDragging
              ? "primary.main"
              : "rgba(255,255,255,0.1)",
            borderRadius: 3,
            p: 5,
            textAlign: "center",
            transition: "all 0.3s",
            background: isDragging
              ? "rgba(99,102,241,0.08)"
              : "rgba(255,255,255,0.02)",
            "&:hover": {
              borderColor: "rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.04)",
            },
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".zip"
            onChange={(e) =>
              e.target.files && handleFileSelected(e.target.files[0])
            }
          />

          {uploadMutation.isPending ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
              <CircularProgress size={28} sx={{ color: "primary.main" }} />
              <Typography variant="body2" color="text.primary" fontWeight={500}>
                Analyzing project...
              </Typography>
            </Box>
          ) : selectedFile ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <UploadIcon sx={{ fontSize: 32, color: "primary.main" }} />
              <Typography variant="body2" color="text.primary" fontWeight={500}>
                {selectedFile.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {(selectedFile.size / 1024).toFixed(1)} KB — click to change
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: "50%",
                  background: isDragging
                    ? "rgba(99,102,241,0.15)"
                    : "rgba(255,255,255,0.05)",
                  transition: "all 0.3s",
                  color: isDragging ? "primary.main" : "text.secondary",
                }}
              >
                <UploadIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="body2" color="text.primary" fontWeight={500}>
                Drop .zip project here
              </Typography>
              <Typography variant="caption" color="text.secondary">
                or click to browse local files
              </Typography>
            </Box>
          )}
        </Box>

        {/* Divider */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            my: 3,
          }}
        >
          <Box sx={{ flex: 1, borderTop: "1px solid rgba(255,255,255,0.06)" }} />
          <Typography
            sx={{
              mx: 2,
              color: "rgba(255,255,255,0.2)",
              fontSize: "0.625rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
            }}
          >
            OR
          </Typography>
          <Box sx={{ flex: 1, borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        </Box>

        {/* GitHub URL Form (Formik) */}
        <form onSubmit={formik.handleSubmit}>
          <TextField
            id="githubUrl"
            name="githubUrl"
            fullWidth
            placeholder="https://github.com/username/repo"
            value={formik.values.githubUrl}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.githubUrl && Boolean(formik.errors.githubUrl)}
            helperText={formik.touched.githubUrl && formik.errors.githubUrl}
            disabled={isAnalyzing}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <GitHubIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ mb: 2.5 }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isAnalyzing || !formik.values.githubUrl.trim()}
            sx={{
              py: 1.5,
              borderRadius: 3,
              fontSize: "0.8125rem",
              fontWeight: 600,
              background:
                isAnalyzing || !formik.values.githubUrl.trim()
                  ? "rgba(255,255,255,0.03)"
                  : "linear-gradient(135deg, #4f46e5, #7c3aed)",
              "&:hover": {
                background: "linear-gradient(135deg, #4338ca, #6d28d9)",
              },
              "&.Mui-disabled": {
                color: "rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.03)",
              },
            }}
            startIcon={
              githubMutation.isPending ? (
                <CircularProgress size={16} sx={{ color: "rgba(165,180,252,1)" }} />
              ) : (
                <GitHubIcon sx={{ fontSize: 18 }} />
              )
            }
          >
            {githubMutation.isPending
              ? "Analyzing Repository..."
              : "Analyze GitHub Repository"}
          </Button>
        </form>

        {/* Error Message */}
        {errorMessage && (
          <Alert
            severity="error"
            sx={{ mt: 2, borderRadius: 2 }}
            onClose={() => {
              setFileError(null);
              uploadMutation.reset();
              githubMutation.reset();
            }}
          >
            {errorMessage}
          </Alert>
        )}
      </DialogContent>

      {/* Footer */}
      <DialogActions
        sx={{
          px: 3,
          py: 1.5,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          justifyContent: "space-between",
          background: "rgba(16,16,20,0.8)",
        }}
      >
        <Box sx={{ display: "flex", gap: 1 }}>
          <Chip label="TypeScript" size="small" variant="outlined" sx={{ fontSize: "0.625rem", height: 20 }} />
          <Chip label="JavaScript" size="small" variant="outlined" sx={{ fontSize: "0.625rem", height: 20 }} />
        </Box>
        <Button
          onClick={onClose}
          disabled={isAnalyzing}
          size="small"
          sx={{ color: "text.secondary", fontSize: "0.6875rem" }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
