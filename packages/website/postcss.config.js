// postcss.config.js
module.exports = {
  purge: ["./*.html", "./src/**/*.html", "./src/**/*.ts"],
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
