module.exports = {
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
            h2: {
              color: "#FFFFFF",
            },
            h3: {
              color: "#FFFFFF",
            },
            h4: {
              color: "#FFFFFF",
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
