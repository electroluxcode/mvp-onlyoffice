import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    // 添加对 WASM 文件的支持
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // 处理 .wasm 和 .mjs 文件
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // 减少文件监听，避免 EMFILE 错误
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
      ],
      aggregateTimeout: 300,
      poll: 1000, // 使用轮询代替文件监听
    };

    return config;
  },
  // 添加必要的安全头部，支持 SharedArrayBuffer（WASM 多线程需要）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
