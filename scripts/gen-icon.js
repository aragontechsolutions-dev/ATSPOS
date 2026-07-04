// Genera los assets del ícono de ATSPOS a partir de un SVG vectorial (sin
// dependencia de fuentes). Ejecutar: node scripts/gen-icon.js
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const GREEN = '#0B6E4F';
const GREEN_DARK = '#08533B';
const LINE = '#8FE0C6';
const OUT = path.join(__dirname, '..', 'assets', 'images');

// Construye el mark (ticket + insignia de check) centrado en un lienzo 1024.
function mark({ color = '#FFFFFF', badge = true } = {}) {
  const left = 336;
  const right = 688;
  const top = 288;
  const flat = 628;
  const teeth = 8;
  const toothW = (right - left) / teeth;
  const up = flat;
  const down = flat + 44;

  let zig = `M ${left} ${top + 24} Q ${left} ${top} ${left + 24} ${top} L ${right - 24} ${top} Q ${right} ${top} ${right} ${top + 24} L ${right} ${up}`;
  for (let i = 0; i < teeth; i++) {
    const x1 = right - i * toothW - toothW / 2;
    const x2 = right - (i + 1) * toothW;
    zig += ` L ${x1} ${down} L ${x2} ${up}`;
  }
  zig += ' Z';

  const lines = [372, 442, 512]
    .map((y) => `<rect x="392" y="${y}" width="240" height="26" rx="13" fill="${LINE}"/>`)
    .join('');

  const badgeSvg = badge
    ? `<circle cx="656" cy="656" r="108" fill="${GREEN}"/>
       <circle cx="656" cy="656" r="108" fill="none" stroke="${color}" stroke-width="16"/>
       <path d="M 610 656 L 644 690 L 706 622" fill="none" stroke="${color}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';

  return `
    <path d="${zig}" fill="${color}"/>
    ${badge ? lines : ''}
    ${badgeSvg}
  `;
}

function svg({ background, markColor = '#FFFFFF', badge = true, pad = 0 }) {
  const bg = background
    ? `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${GREEN}"/><stop offset="1" stop-color="${GREEN_DARK}"/>
       </linearGradient></defs>
       <rect width="1024" height="1024" rx="220" fill="url(#g)"/>`
    : '';
  const scale = 1 - pad;
  const tx = (1024 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${bg}
    <g transform="translate(${tx} ${tx}) scale(${scale})">${mark({ color: markColor, badge })}</g>
  </svg>`;
}

function render(svgStr, size) {
  return new Resvg(svgStr, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

function write(name, svgStr, size) {
  fs.writeFileSync(path.join(OUT, name), render(svgStr, size));
  console.log('✓', name);
}

// Ícono principal (iOS / legacy Android): fondo verde + mark.
write('icon.png', svg({ background: true }), 1024);
// Adaptive icon de Android.
write('android-icon-foreground.png', svg({ background: false, pad: 0.34 }), 1024);
write('android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${GREEN}"/></svg>`, 1024);
write('android-icon-monochrome.png', svg({ background: false, markColor: '#FFFFFF', badge: false, pad: 0.34 }), 1024);
// Splash y favicon.
write('splash-icon.png', svg({ background: false, badge: true, pad: 0.12 }), 512);
write('favicon.png', svg({ background: true }), 96);
