/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Socket.io client-side fix
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        stream: false,
        dgram: false,
        child_process: false,
        dns: false,
        querystring: false
      };
    }
    
    return config;
  },
  env: {
    // Server-side environment variables
    SPORTRADAR_API_KEY: process.env.SPORTRADAR_API_KEY,
    SPORTS_DATA_WS_API_KEY: process.env.SPORTS_DATA_WS_API_KEY,
    
    // Make them available to the client as well
    NEXT_PUBLIC_SPORTRADAR_API_KEY: process.env.SPORTRADAR_API_KEY,
    NEXT_PUBLIC_SPORTS_DATA_WS_API_KEY: process.env.SPORTS_DATA_WS_API_KEY,
  },
};

module.exports = nextConfig; 