import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#7C3AED",
        secondary: "#EC4899",
        background: "#0F172A",
        foreground: "#F1F5F9",
        card: "#1E293B",
        border: "#334155",
        success: "#10B981",
        error: "#EF4444",
        warning: "#F59E0B",
      },
    },
  },
  plugins: [],
};

export default config;
