const plugin = require("tailwindcss/plugin");

module.exports = {
  mode: "jit",
  purge: ["./index.html"],
  darkMode: false, // or 'media' or 'class'
  theme: {
    colors: {
      navy: "#030052",
      lightBlue: "#A09ED9",
      yellow: "#FFE234",
      black: "#000",
      white: "#fff",
      pink: "#ff34b1",
      darkPink: "#330B24",
    },
    fontFamily: {
      sans: [
        "-apple-system",
        "BlinkMacSystemFont",
        "Segoe UI",
        "Roboto",
        "Helvetica",
        "Arial",
        "sans-serif",
        "Apple Color Emoji",
        "Segoe UI Emoji",
        "Segoe UI Symbol",
      ],
      tobias: [
        "Tobias",
        "ui-serif",
        "Georgia",
        "Cambria",
        "Times New Roman",
        "Times",
        "serif",
      ],
      mono: [
        '"MD IO"',
        "ui-monospace",
        "SFMono-Regular",
        "Menlo",
        "Monaco",
        "Consolas",
        '"Liberation Mono"',
        '"Courier New"',
        "monospace",
      ],
    },
    extend: {
      typography: {
        DEFAULT: {
          css: {
            color: "#FFFFFF",
            a: {
              color: "#FFE234",
            },
            h1: {
              color: "#FFE234",
            },
            "h2, h3, h4": {
              color: "#FFFFFF",
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
  plugins: [
    require("@tailwindcss/typography"),
    plugin(({ addUtilities }) => {
      addUtilities(
        {
          ".columns-1": {
            columns: "1",
          },
          ".columns-2": {
            columns: "2",
          },
          ".columns-3": {
            columns: "3",
          },
        },
        { variants: ["responsive"] }
      );
    }),
  ],
};
