import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'xlsx'],
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/assets/:path*',
          destination: 'https://reviewmine.app/assets/:path*',
        },
        {
          source: '/images/:path*',
          destination: 'https://reviewmine.app/images/:path*',
        },
        {
          source: '/icon.svg',
          destination: 'https://reviewmine.app/icon.svg',
        },
        {
          source: '/cdn-cgi/:path*',
          destination: 'https://reviewmine.app/cdn-cgi/:path*',
        },
      ],
    };
  },
};

export default nextConfig;
