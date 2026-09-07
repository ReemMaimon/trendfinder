import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "'Rubik'",
          "'Assistant'",
          "system-ui",
          "-apple-system",
          "'Segoe UI'",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          900: "#7c2d12",
        },
        ink: {
          DEFAULT: "#111827",
          soft: "#374151",
          muted: "#6b7280",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        card: "0 4px 24px -6px rgba(17, 24, 39, 0.12)",
        cta: "0 8px 24px -6px rgba(234, 88, 12, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
