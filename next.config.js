const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['lucide-react'],
  staticPageGenerationTimeout: 120,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  swcMinify: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(__dirname, 'src'),
      '@ui': path.resolve(__dirname, 'src/interfaces/ui'),
      '@components': path.resolve(__dirname, 'src/interfaces/ui/components'),
      '@styles': path.resolve(__dirname, 'src/interfaces/ui/styles'),
      '@packages': path.resolve(__dirname, 'packages'),
      '@packages/ai': path.resolve(__dirname, 'packages/ai/src'),
      '@packages/core': path.resolve(__dirname, 'packages/core/src'),
      '@packages/infra': path.resolve(__dirname, 'packages/infra/src'),
    };
    return config;
  },
};

module.exports = nextConfig;
