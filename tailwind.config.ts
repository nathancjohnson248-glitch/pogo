import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F2E9",
        ink: "#24251F",
        moss: "#737B59",
        clay: "#D97850"
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        sans: ["Arial", "Helvetica", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;