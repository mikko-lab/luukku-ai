import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          blue:  "#0071E3",
          blueh: "#0077ED",
          bg:    "#F5F5F7",
          gray:  "#6E6E73",
        },
      },
      boxShadow: {
        card: "0 2px 12px 0 rgba(0,0,0,0.07)",
      },
    },
  },
  plugins: [],
} satisfies Config;
