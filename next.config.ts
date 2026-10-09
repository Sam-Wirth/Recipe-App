import type { NextConfig } from 'next';

// To open the dev server from another device on your network (e.g. your phone),
// add that computer's LAN address to .env.local, comma-separated if more than one:
//   DEV_ORIGINS=192.168.1.50
const devOrigins = (process.env.DEV_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,

  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
