/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 바닐라폼 컨셉: 바닐라 크림 + 포레스트 그린
        volt: {
          DEFAULT: "#E7B65D",
          50: "#FFF8E8",
        },
        obsidian: {
          DEFAULT: "#050505",
        },
        crystal: {
          DEFAULT: "#F5F5F5",
        },
        brand: {
          50: "#f3f8f5",
          100: "#e4efe8",
          200: "#c9dfd2",
          300: "#9fc7af",
          400: "#70aa88",
          500: "#4c8e6b",
          600: "#377255",
          700: "#2d5b46",
          800: "#264a3b",
          900: "#1f3d31",
          950: "#10231b",
        },
      },
      fontFamily: {
        // 본문: 둥근 영문(Nunito) + 한글(Pretendard/Noto Sans KR)
        sans: [
          "Nunito",
          "Pretendard",
          "Noto Sans KR",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        // 제목/로고 느낌: 통통하고 둥근 Baloo 2 + 귀여운 한글 Jua
        display: [
          "Baloo 2",
          "Jua",
          "Fredoka",
          "Nunito",
          "Noto Sans KR",
          "sans-serif",
        ],
      },
      borderRadius: {
        // 전반적으로 살짝 더 둥글게(친근한 톤)
        "4xl": "2rem",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "count-down": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.5s ease-out",
        "fade-in": "fade-in 0.6s ease-out",
        "count-down": "count-down 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
