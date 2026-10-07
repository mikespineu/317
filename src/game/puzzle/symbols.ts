// The symbol set shared by the symbol lock UI, the portraits and (later) the
// lock's dials in the scene, so they always match. Each path is drawn in a
// 24 x 24 box and filled (fill-rule evenodd), with no stroke.
export interface SymbolIcon {
  label: string
  path: string
}

export const SYMBOL_BOX = 24

// Woodblock silhouettes: one solid shape each, with the few cut-outs that make
// it read at 32 px. Cut-outs wind the other way from the outline (and the eye's
// pupil the same way again), so the paths fill the same with evenodd and nonzero.
export const SYMBOLS: Readonly<Record<string, SymbolIcon>> = {
  // a crescent, open to the right
  moon: {
    label: 'moon',
    path: 'M15.5 2.6A9.6 9.6 0 1 0 21.4 14.6A7 7 0 1 1 15.5 2.6Z',
  },
  // spread wings, two ears, three points along the lower edge
  bat: {
    label: 'bat',
    path:
      'M12 7.4L13.7 4.4L14.8 8.2Q18.6 5 22.8 6.6Q23.2 11 20.6 14.8Q18.4 12 16.4 17' +
      'Q14.4 13.8 12 19.8Q9.6 13.8 7.6 17Q5.6 12 3.4 14.8Q.8 11 1.2 6.6Q5.4 5 9.2 8.2L10.3 4.4Z',
  },
  // a squat lantern with a bent stem, two eyes and a toothed grin
  pumpkin: {
    label: 'pumpkin',
    path:
      'M10.6 6.9L10.9 3.6Q11 2.4 12.4 2.5L14.6 2.8L14.2 4.6L13.2 4.6L13.4 6.9' +
      'C19.5 5.8 22 10 22 13.6C22 18.4 18.4 21.6 12 21.6C5.6 21.6 2 18.4 2 13.6' +
      'C2 10 4.5 5.8 10.6 6.9Z' +
      'M8.4 10L6.6 13.4L10.2 13.4Z' +
      'M15.6 10L13.8 13.4L17.4 13.4Z' +
      'M6 15.4Q12 21.6 18 15.4L15.4 16.6L14 15.6L12 16.8L10 15.6L8.6 16.6Z',
  },
  // an old door key: ring bow on the left, two wards on the right
  key: {
    label: 'key',
    path:
      'M10.89 11H22V17H19.8V13H18.4V16H16.2V13H10.89A4.5 4.5 0 1 1 10.89 11Z' +
      'M6.5 9.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4Z',
  },
  // an almond eye: the iris is cut out as a ring around a solid pupil
  eye: {
    label: 'eye',
    path:
      'M1.5 12Q12 1.5 22.5 12Q12 22.5 1.5 12Z' +
      'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z' +
      'M12 10.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6Z',
  },
}
