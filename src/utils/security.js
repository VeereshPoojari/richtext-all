/**
 * Zero-Dependency Security & Sanitization Utilities for richtext-all
 * Protects against XSS, dangerous script injections, and malformed URLs.
 */

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'blob:']);
const SAFE_DATA_IMAGE_PREFIX = /^data:image\/(?:png|jpeg|jpg|gif|svg\+xml|webp|bmp);base64,/i;

export function sanitizeUrl(url, allowDataImage = true) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();

  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./')) {
    return escapeHtml(trimmed);
  }

  if (allowDataImage && SAFE_DATA_IMAGE_PREFIX.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed, 'https://placeholder.local');
    if (SAFE_PROTOCOLS.has(parsed.protocol)) {
      return escapeHtml(trimmed);
    }
  } catch {
    // invalid URL
  }

  return '#';
}

export function sanitizeColor(color) {
  if (!color || typeof color !== 'string') return '';
  const trimmed = color.trim();
  if (/^(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9\s,%./-]+\)|[a-zA-Z]{3,20})$/.test(trimmed)) {
    return trimmed;
  }
  return '';
}

/**
 * Sanitizes raw HTML string for safe DOM insertion
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
}
