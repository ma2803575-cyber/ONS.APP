/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        emerald: { 50:'#eef2ff', 100:'#dde5fb', 200:'#bccaf5', 300:'#93a8ec', 400:'#6784df', 500:'#4163cc', 600:'#2f4ea8', 700:'#25408c', 800:'#1b2f6b', 900:'#14234f', 950:'#0a1433' },
        gold: { 50:'#fbf7ea',100:'#f5ecc9',200:'#ebd998',300:'#dcc06a',400:'#cfab4a',500:'#c9a24b',600:'#a8832f',700:'#86661f' },
        paper: '#fbfaf5',
      },
      fontFamily: { sans: ['Cairo','Tajawal','system-ui','sans-serif'], quran: ['"Amiri Quran"','Amiri','serif'] },
      keyframes: { fadeUp: { '0%':{opacity:0,transform:'translateY(8px)'}, '100%':{opacity:1,transform:'none'} }, pop: { '0%':{transform:'scale(1)'}, '50%':{transform:'scale(.94)'}, '100%':{transform:'scale(1)'} } },
      animation: { fadeUp: 'fadeUp .35s ease both', pop: 'pop .15s ease' },
    },
  },
  plugins: [],
}
