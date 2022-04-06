module.exports = {
  mode: "JIT",
  purge: ["./index.html", "./src/**/*.{js,ts}"],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            color: "#2d2d2d",
            a: {
              color: "#008c9d",
            },
            h1: {
              color: "#2ad8a4",
            },
            "h2, h3, h4": {
              color: "#212c64",
            },
            "p, li": {
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            },
            code: {
              color: "#ff2ea8",
            },
            "code::before": {
              content: "",
            },
            "code::after": {
              content: "",
            },
          },
        },
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
