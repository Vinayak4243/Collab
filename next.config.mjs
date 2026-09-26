/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist and ffmpeg.wasm need these fallbacks disabled for the browser bundle
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
};
export default nextConfig;
