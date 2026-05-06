import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

/**
 * Bloomberg dark terminal palette.
 *
 * Generated from a `/theme-factory` brief: "Institutional financial terminal.
 * Dark navy and charcoal background, amber + neon-cyan accents, mono numerals,
 * generous use of borders, no glassmorphism, no rounded corners larger than md,
 * dense information layout."
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0A0E1A",
          elevated: "#0F1424",
          overlay: "#141A2E",
        },
        border: {
          DEFAULT: "#1F2742",
          strong: "#2D3654",
        },
        text: {
          DEFAULT: "#E8ECF7",
          muted: "#8B96B5",
          subtle: "#5C6889",
        },
        accent: {
          amber: "#FFB000",
          cyan: "#00E5FF",
          green: "#00C896",
          red: "#FF4757",
        },
        rating: {
          buy: "#00C896",
          overweight: "#7FE5A8",
          hold: "#8B96B5",
          underweight: "#FFB347",
          sell: "#FF4757",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      letterSpacing: { ticker: "0.05em" },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
      },
      boxShadow: {
        terminal: "0 0 0 1px rgba(31,39,66,0.6), 0 1px 2px rgba(0,0,0,0.4)",
      },
      keyframes: {
        "scan-line": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.9" },
        },
        "pulse-amber": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255,176,0,0.6)" },
          "50%": { boxShadow: "0 0 0 4px rgba(255,176,0,0)" },
        },
      },
      animation: {
        "scan-line": "scan-line 3s ease-in-out infinite",
        "pulse-amber": "pulse-amber 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [animate, typography],
};

export default config;
