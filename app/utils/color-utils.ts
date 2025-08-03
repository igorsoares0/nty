export const formatHexColor = (color: string) => {
  if (!color.startsWith('#')) {
    color = '#' + color;
  }
  return color.length === 7 ? color : '#000000';
};

export const hexToHsb = (hex: string) => {
  if (!hex || hex.length !== 7 || !hex.startsWith('#')) {
    return { hue: 0, saturation: 0, brightness: 1 };
  }

  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let hue = 0;
  if (diff !== 0) {
    if (max === r) hue = ((g - b) / diff) % 6;
    else if (max === g) hue = (b - r) / diff + 2;
    else hue = (r - g) / diff + 4;
  }
  hue = hue * 60;
  if (hue < 0) hue += 360;

  const saturation = max === 0 ? 0 : diff / max;
  const brightness = max;

  return {
    hue: Math.max(0, Math.min(360, hue)),
    saturation: Math.max(0, Math.min(1, saturation)),
    brightness: Math.max(0, Math.min(1, brightness)),
  };
};

export const hsbToHex = (hsb: {hue: number, saturation: number, brightness: number}) => {
  let { hue, saturation, brightness } = hsb;
  
  if (hue > 1) {
    hue = hue / 360;
  }
  
  const h = hue * 360;
  const s = saturation;
  const v = brightness;

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

  r = Math.max(0, Math.min(255, Math.round((r + m) * 255)));
  g = Math.max(0, Math.min(255, Math.round((g + m) * 255)));
  b = Math.max(0, Math.min(255, Math.round((b + m) * 255)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};