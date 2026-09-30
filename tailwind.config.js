/** Same settings the CDN used in index.html and AR.html (darkMode + the 3 spacing values). */
module.exports = {
  content: [
    "./index.html",
    "./AR.html",
    "./*.js"
  ],
  darkMode: "class",
  theme: {
    extend: {
      spacing: {
        "gutter": "24px",
        "stack-lg": "48px",
        "stack-md": "32px"
      }
    }
  },
  plugins: []
};
