const plugin = require("tailwindcss/plugin");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.ts", "./src/**/*.md", "./index.html"],
  theme: {
    colors: {
      transparent: "transparent",
      navy: "#030052",
      lightBlue: "#A09ED9",
      yellow: "#FFE234",
      black: "#000",
      white: "#fff",
      pink: "#ff34b1",
      darkPink: "#330B24",
      red: "#eb4950",
      lightGrey: "#ececec",
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
            lineHeight: "1.6",
            color: "#FFFFFF",
            a: {
              color: "#FFE234",
            },
            h1: {
              color: "#FFE234",
              lineHeight: "1.35",
            },
            "h2, h3, h4": {
              color: "#FFFFFF",
            },
            "p, li": {
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            },
            "li::marker": {
              color: "#FFE234",
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
            blockquote: {
              color: "#FFFFFF",
            },
            aside: {
              borderLeft: "4px solid #FFE234",
              paddingLeft: "2rem",
              fontSize: "0.95em",
              "h1, h2, h3": {
                color: "#FFE234",
              },
            },
          },
        },
      },
    },
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
