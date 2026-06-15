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
        primary: '#D4537E',
        'primary-light': '#FBEAF0',
        'primary-dark': '#B8406A',
        'border-pink': '#F0D0DC',
      },
    },
  },
  plugins: [],
}
export default config
