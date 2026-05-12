/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@chcgreen/shared', '@chcgreen/ui'],
};

export default nextConfig;
