import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "et-splash-bar": {
          "0%": { transform: "translateX(-130%)" },
          "100%": { transform: "translateX(380%)" }
        }
      },
      animation: {
        "et-splash-bar": "et-splash-bar 1.15s ease-in-out infinite"
      }
    }
  },
  plugins: []
} satisfies Config;

