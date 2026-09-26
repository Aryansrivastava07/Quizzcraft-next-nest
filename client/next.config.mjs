/** @type {import('next').NextConfig} */
const backendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:5000';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/auth/:path*',
        destination: `${backendUrl}/auth/:path*`,
      },
      {
        source: '/api/quiz/:path*',
        destination: `${backendUrl}/api/quiz/:path*`,
      },
      {
        source: '/api/profile/:path*',
        destination: `${backendUrl}/api/profile/:path*`,
      },
      {
        source: '/health/:path*',
        destination: `${backendUrl}/health/:path*`,
      },
      {
        source: '/api/health/:path*',
        destination: `${backendUrl}/api/health/:path*`,
      },
    ];
  },
};

export default nextConfig;
