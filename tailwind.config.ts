import type { Config } from "tailwindcss";

const config: Config & { daisyui?: any } = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["dark", "night", "forest", "sunset"],
    darkTheme: "night",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: false,
  },
};

export default config;