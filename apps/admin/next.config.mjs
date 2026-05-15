/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/vkadm',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@chcgreen/shared', '@chcgreen/ui'],
  // Force DefinePlugin to inline at build time; also invalidates webpack cache when changed
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
};

export default nextConfig;
