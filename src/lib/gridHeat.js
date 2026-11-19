import { interpolateRgbBasis, rgb } from 'd3';

/** Quantitative count scale. It is not the race-result palette. */
export const GRID_HEAT_LOW = '#1d4ed8';
export const GRID_HEAT_MID = '#d946ef';
export const GRID_HEAT_HIGH = '#ff7a00';

const heat = interpolateRgbBasis([GRID_HEAT_LOW, GRID_HEAT_MID, GRID_HEAT_HIGH]);

/**
 * Square-root ramp so a cell well below the peak is not the same blue as a single start.
 * `t = 0` is the low color, `t = 1` is the high color. The peak is the current filter.
 */
export function gridHeat(count, peak) {
  const safePeak = peak > 0 ? peak : 1;
  const ratio = Math.min(1, Math.max(0, count / safePeak));
  return heat(Math.sqrt(ratio));
}

/** Light text on a dark square, dark text on a bright square. */
export function gridHeatText(color) {
  const { r, g, b } = rgb(color);
  const channel = (value) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.22 ? '#141018' : '#ffffff';
}
