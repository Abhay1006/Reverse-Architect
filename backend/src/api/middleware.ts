import multer from 'multer';
import os from 'os';
import rateLimit from 'express-rate-limit';

// Multer: store uploads in a temp directory, limit to 50MB
export const upload = multer({ 
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window`
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// Stricter limiter for heavy analysis endpoints
export const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 30, // Limit each IP to 30 analysis requests per window
  message: { error: 'Analysis quota exceeded. Please try again or host your own instance.' },
});
