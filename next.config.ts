/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    SPORTRADAR_API_KEY: process.env.SPORTRADAR_API_KEY,
    SPORTS_DATA_WS_API_KEY: process.env.SPORTS_DATA_WS_API_KEY,
  },
};

export default nextConfig;
