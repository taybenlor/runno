const crossOriginPolicy = {
  name: "configure-server",

  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    });
  },
};

export default {
  publicDir: "public",
  define: {
    "process.platform": JSON.stringify(null),
    "process.env.NODE_DEBUG": JSON.stringify(false),
    "process.browser": JSON.stringify(true),
  },
  server: {
    port: 5678,
  },
  plugins: [crossOriginPolicy],
};
