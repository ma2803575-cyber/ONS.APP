/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        emerald: { 50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b',950:'#022c22' },
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
