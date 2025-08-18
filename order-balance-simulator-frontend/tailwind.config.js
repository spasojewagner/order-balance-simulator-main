/** @type {import('tailwindcss').Config} */
import "./public/trading-view-chart.cjs";
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {},
    plugins: [require("tailwind-scrollbar")],
};