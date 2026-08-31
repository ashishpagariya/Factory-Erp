import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#12151A",
        surface: "#1A1F27",
        surface2: "#212832",
        surface3: "#2A323D",
        border: "#313B47",
        text: "#E9EBEF",
        "text-dim": "#9AA5B3",
        "text-faint": "#6B7684",
        gold: "#C9A24B",
        "gold-bright": "#E4C069",
        "gold-dim": "#8A7239",
        green: "#4FAE81",
        red: "#E15A5A",
        amber: "#D99A45",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { xl: "10px" },
    },
  },
  plugins: [],
};
export default config;
