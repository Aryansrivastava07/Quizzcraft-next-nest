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
        source: '/api/org/:path*',
        destination: `${backendUrl}/api/org/:path*`,
      },
      {
        source: '/api/super-admin/:path*',
        destination: `${backendUrl}/api/super-admin/:path*`,
      },
      {
        source: '/api/groups/:path*',
        destination: `${backendUrl}/api/groups/:path*`,
      },
      {
        source: '/api/notifications/:path*',
        destination: `${backendUrl}/api/notifications/:path*`,
      },
      {
        source: '/health/:path*',
        destination: `${backendUrl}/health/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
      {
        source: '/api/health/:path*',
        destination: `${backendUrl}/api/health/:path*`,
      },
    ];
  },
};

export default nextConfig;
