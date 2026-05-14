/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/vkadm',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@chcgreen/shared', '@chcgreen/ui'],
};

export default nextConfig;
