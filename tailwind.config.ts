import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'geolarp-primary': '#10b981',
        'geolarp-secondary': '#3b82f6',
        'geolarp-accent': '#8b5cf6',
      },
    },
  },
  plugins: [],
}

export default config