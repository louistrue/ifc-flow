/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  webpack: (config) => {
    // Add WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add rule for WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
      generator: {
        filename: "static/wasm/[name][ext]",
      },
    });

    return config;
  },
  // Configure headers to set correct MIME type for WASM files
  async headers() {
    return [
      {
        source: "/:path*.wasm",
        headers: [
          {
            key: "Content-Type",
            value: "application/wasm",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
