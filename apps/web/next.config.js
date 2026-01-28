/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@airshare/ui',
    '@airshare/shared',
    '@airshare/crypto',
    '@airshare/webrtc',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '*.cloudflare.com',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
  },
};

module.exports = nextConfig;
