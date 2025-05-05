/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Server-side environment variables
    SPORTRADAR_API_KEY: process.env.SPORTRADAR_API_KEY,
    SPORTS_DATA_WS_API_KEY: process.env.SPORTS_DATA_WS_API_KEY,
    
    // Make them available to the client as well
    NEXT_PUBLIC_SPORTRADAR_API_KEY: process.env.SPORTRADAR_API_KEY,
    NEXT_PUBLIC_SPORTS_DATA_WS_API_KEY: process.env.SPORTS_DATA_WS_API_KEY,
  },
};

export default nextConfig;
