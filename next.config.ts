import type { NextConfig } from "next";

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Allow WASM execution for on-device models and workers
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Allow fetching model files from Hugging Face and mirrors (redirects hit cdn-lfs.huggingface.co)
  "connect-src 'self' data: blob: https://huggingface.co https://*.huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://cdn-lfs.hf.co https://*.hf.co https://cdn.jsdelivr.net https://*.jsdelivr.net https://models.huggingface.co https://*.amazonaws.com https://s3.amazonaws.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // credentialless is more compatible for third-party model/CDN assets
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Temporarily disable CSP for debugging
  // headers: async () => [
  //   {
  //     source: '/:path*',
  //     headers: securityHeaders,
  //   },
  // ],
  webpack: (config, { isServer }) => {
    // Configure webpack for better Transformers.js support
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  experimental: {
    // Disable Turbopack if it's enabled
    turbo: undefined,
  },
};

export default nextConfig;
