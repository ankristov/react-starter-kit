export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + (
    (r.toString(16).padStart(2, "0")) +
    (g.toString(16).padStart(2, "0")) +
    (b.toString(16).padStart(2, "0"))
  );
}

export function tweakHexColor(hexColor: string, range: number): string {
  const rgbArray = hexToRgb(hexColor);
  const newRGBArray = [
    Math.floor(rgbArray.r + range * Math.random() - range / 2),
    Math.floor(rgbArray.g + range * Math.random() - range / 2),
    Math.floor(rgbArray.b + range * Math.random() - range / 2)
  ];
  return rgbToHex(newRGBArray[0], newRGBArray[1], newRGBArray[2]);
}

export function getHueFromHex(hex: string): number {
  const rgb = hexToRgb(hex);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;

  if (delta === 0) {
    hue = 0;
  } else if (max === r) {
    hue = (g - b) / delta;
  } else if (max === g) {
    hue = 2 + (b - r) / delta;
  } else {
    hue = 4 + (r - g) / delta;
  }

  hue *= 60;
  if (hue < 0) {
    hue += 360;
  }

  return hue;
}

export function rgbToHue(r: number, g: number, b: number): number {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const hue = Math.atan2(Math.sqrt(3) * (gNorm - bNorm), 2 * rNorm - gNorm - bNorm);
  return hue * 180 / Math.PI;
}

export function rgbToSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (max - min) / max;
}

export function rgbToLightness(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (max + min) / 2 / 255;
}

export function interpolateHex(hex1: string, hex2: string, factor: number): string {
  const hex1RGB = hexToRgb(hex1);
  const hex2RGB = hexToRgb(hex2);

  const newR = Math.round(hex1RGB.r + (hex2RGB.r - hex1RGB.r) * factor);
  const newG = Math.round(hex1RGB.g + (hex2RGB.g - hex1RGB.g) * factor);
  const newB = Math.round(hex1RGB.b + (hex2RGB.b - hex1RGB.b) * factor);

  return `rgb(${newR}, ${newG}, ${newB})`;
}

export function getAverageColor(chosenPixels: Uint8ClampedArray): string {
  let r = 0;
  let g = 0;
  let b = 0;
  const count = chosenPixels.length / 4;
  
  for (let i = 0; i < count; i++) {
    r += chosenPixels[i * 4];
    g += chosenPixels[i * 4 + 1];
    b += chosenPixels[i * 4 + 2];
  }

  return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`;
}

export function isColorSimilar(color1: number, color2: number, tolerance: number): boolean {
  const r1 = (color1 >> 16) & 255;
  const g1 = (color1 >> 8) & 255;
  const b1 = color1 & 255;

  const r2 = (color2 >> 16) & 255;
  const g2 = (color2 >> 8) & 255;
  const b2 = color2 & 255;

  const deltaR = Math.abs(r1 - r2);
  const deltaG = Math.abs(g1 - g2);
  const deltaB = Math.abs(b1 - b2);

  return deltaR <= tolerance && deltaG <= tolerance && deltaB <= tolerance;
}

export function colorToHex(color: number): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return rgbToHex(r, g, b);
}

export function randomWithinRange(value: number, range: number): number {
  return value + (Math.random() - 0.5) * range;
}

export function calcWeightedAverage(data: number[], weights: number[]): number {
  let sum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * weights[i];
    weightSum += weights[i];
  }
  
  return sum / weightSum;
} 