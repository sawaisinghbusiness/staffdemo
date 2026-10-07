import type { Config } from "tailwindcss";

/**
 * Same colours as the ERP (SMS BARMER/tailwind.config.ts), so the school sees one product.
 * Colour carries meaning only: jade = present / paid, red = absent / due, marigold = needs attention.
 */
const ink = {
  50: "#F7F8FB",
  100: "#EFF1F6",
  200: "#E2E6EF",
  300: "#CBD2DF",
  400: "#97A1B6",
  500: "#687389",
  600: "#4C566B",
  700: "#394153",
  800: "#252C3B",
  900: "#161B27",
  950: "#0C1019",
};

const jade = {
  50: "#ECFDF7",
  100: "#D1FAEC",
  200: "#A6F2DA",
  500: "#12B28C",
  600: "#089173",
  700: "#07745E",
  800: "#0A5C4C",
};

const marigold = {
  50: "#FFF9EB",
  100: "#FEEFC7",
  300: "#FCC74D",
  400: "#FAB124",
  500: "#F2A516",
  600: "#D67C07",
  700: "#B1580A",
};

const indigo = {
  50: "#EEF0FF",
  100: "#E0E4FF",
  200: "#C7CDFE",
  500: "#5A66E8",
  600: "#3446D1",
  700: "#2B38AE",
  800: "#252F8C",
};

const night = {
  300: "#A9ADBA",
  400: "#858A99",
  500: "#62677A",
  600: "#454957",
  700: "#2E313B",
  800: "#22242C",
  850: "#1B1D23",
  900: "#141519",
  950: "#0D0E11",
};

const rose = {
  50: "#FFF1F1",
  100: "#FFE1E1",
  500: "#E5484D",
  600: "#CE2C31",
  700: "#AA2429",
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { slate: ink, ink, jade, emerald: jade, marigold, brand: indigo, night, rose, red: rose, canvas: "#ECEEF3" },
      fontFamily: {
        sans: ["'Plus Jakarta Sans Variable'", "'Noto Sans Devanagari Variable'", "system-ui", "Roboto", "sans-serif"],
      },
      fontSize: {
        // Parents read on small phones, often outdoors: the floor is 14px, body is 17px.
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],
        base: ["1.0625rem", { lineHeight: "1.625rem" }],
      },
      borderRadius: { xl: "0.75rem", "2xl": "1rem" },
      boxShadow: {
        card: "0 1px 2px rgb(21 24 58 / 0.05), 0 10px 26px -16px rgb(21 24 58 / 0.18)",
        bar: "0 -1px 0 rgb(21 24 58 / 0.06), 0 -8px 24px -12px rgb(21 24 58 / 0.12)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        slideUp: { from: { transform: "translateY(100%)" }, to: { transform: "none" } },
        shake: { "0%,100%": { transform: "translateX(0)" }, "25%,75%": { transform: "translateX(-5px)" }, "50%": { transform: "translateX(5px)" } },
      },
      animation: {
        fadeIn: "fadeIn 0.15s ease-out both",
        rise: "rise 0.28s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.5s infinite",
        "slide-up": "slideUp 0.26s cubic-bezier(0.16, 1, 0.3, 1) both",
        shake: "shake 0.32s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
