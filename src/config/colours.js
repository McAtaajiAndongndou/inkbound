// SINGLE SOURCE OF TRUTH for the three paint colours.
// Nobody hardcodes a hex value anywhere else in the codebase.

export const PAINT = {
  BLUE:  { id: 'blue',  hex: 0x3aa7ff, name: 'Ice'    },
  RED:   { id: 'red',   hex: 0xff4d5a, name: 'Bounce' },
  GREEN: { id: 'green', hex: 0x4ee08a, name: 'Grip'   },
};

export const GREY = { id: 'grey', hex: 0x6b6b78, name: 'Dead' };

export const PAINT_LIST = [PAINT.BLUE, PAINT.RED, PAINT.GREEN];
