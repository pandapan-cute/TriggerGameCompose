import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone出力（Dockerで必須）
  output: 'standalone',
  
  // 環境変数
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  },

  // 画像最適化
  images: {
    domains: ['localhost'],
  },

  // その他の設定
  reactStrictMode: true,
};

export default nextConfig;
