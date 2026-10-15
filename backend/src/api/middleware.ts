import multer from 'multer';
import os from 'os';
import rateLimit from 'express-rate-limit';

/** Largest .zip accepted by the upload endpoint (compressed size). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Multer: store uploads in a temp directory, limit to 50MB
export const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

// Rate limits key on req.ip. Behind the Next.js proxy that is only the real
// client when TRUST_PROXY_HOPS is set — see the README's Configuration section.
//
// The proxy routes always forward X-Forwarded-For, and TRUST_PROXY_HOPS=0 is a
// deliberate setting when Next.js is exposed directly (the header cannot be
// trusted then). express-rate-limit's "header set but not trusted" check would
// log an error for that on every start, so it is turned off.
const validate = { xForwardedForHeader: false };

/**
 * General API limiter. Health checks and Code Peek are exempt: health is
 * polled by monitors, and Code Peek has its own, higher limit below because a
 * single user browsing a graph clicks through dozens of files.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window`
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate,
  skip: (req) => req.path === '/health' || req.path === '/code',
});

/** Code Peek reads one file per click — generous, but still bounded. */
export const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: { error: 'Too many file previews from this IP, please try again later' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate,
});

// Stricter limiter for heavy analysis endpoints
export const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 30, // Limit each IP to 30 analysis requests per window
  message: { error: 'Analysis quota exceeded. Please try again or host your own instance.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate,
});
