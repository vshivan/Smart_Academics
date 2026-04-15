import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "bounce-once": {
          "0%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-8px)" },
          "60%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "bounce-once": "bounce-once 0.6s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
