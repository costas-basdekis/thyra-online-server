const _ = require('lodash');
const {MinimumGame} = require('./src/game/MinimumGame');

const puzzles = [
  {position: 'DDAMGGMCCHAAGHAAAAADAAAAD', maxDepth: 1},
  {position: 'MIMMAMHGMGMGGHGDMMIGAADAA', maxDepth: 3},
  {position: 'DAGMGAICBEAGAAAAAAAAAAAAD', maxDepth: 5},
  {position: 'JEJJGJACAEAAAFDGADAAAGAAA', maxDepth: 7},
  {position: 'AGADAIACAADBAAAAADAAAAAED', maxDepth: 7},
  {position: 'DJDDAAGJCAADBEAGAAIAADAGD', maxDepth: 9},
  {position: 'ABJDAAACFAAAAAAEAAAADAAAA', maxDepth: 7},
];
const puzzle = puzzles[6];
const expectedHistoryMoves = {
  'DDAMGGMCCHAAGHAAAAADAAAAD': [
    [[{"x":4,"y":1},{"x":4,"y":2},{"x":4,"y":1}]],[[{"x":3,"y":2},{"x":4,"y":2},{"x":3,"y":2}]],
  ],
  'MIMMAMHGMGMGGHGDMMIGAADAA': [
    [[{"x":3,"y":2},{"x":2,"y":1},{"x":1,"y":2}],[{"x":3,"y":3},{"x":2,"y":2},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":2},{"x":4,"y":1}]],
  ],
  'DAGMGAICBEAGAAAAAAAAAAAAD': [
    [[{"x":1,"y":1},{"x":2,"y":0},{"x":1,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":2,"y":0},{"x":1,"y":0},{"x":0,"y":0}],[{"x":2,"y":2},{"x":3,"y":2},{"x":3,"y":1}],[{"x":1,"y":0},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":2,"y":0},{"x":1,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":2,"y":0},{"x":1,"y":1},{"x":0,"y":0}],[{"x":2,"y":2},{"x":3,"y":1},{"x":4,"y":0}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":2,"y":0},{"x":1,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":2,"y":0},{"x":1,"y":1},{"x":1,"y":0}],[{"x":2,"y":2},{"x":3,"y":2},{"x":3,"y":1}],[{"x":1,"y":1},{"x":2,"y":0},{"x":1,"y":0}]],
    [[{"x":1,"y":1},{"x":2,"y":0},{"x":1,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":2,"y":0},{"x":1,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":1,"y":1},{"x":2,"y":0},{"x":1,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":2,"y":2}],[{"x":2,"y":0},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":1}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":0,"y":1},{"x":0,"y":0}],[{"x":2,"y":2},{"x":3,"y":2},{"x":3,"y":1}],[{"x":0,"y":1},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":1}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":2,"y":2},{"x":3,"y":1},{"x":4,"y":0}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":1}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":1}],[{"x":2,"y":2},{"x":1,"y":3},{"x":0,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":1}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":1}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":2}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":2,"y":2},{"x":3,"y":1},{"x":4,"y":0}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":2}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":2}],[{"x":2,"y":2},{"x":3,"y":1},{"x":4,"y":0}],[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":2}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":2}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":2}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":2,"y":2}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":2,"y":2},{"x":3,"y":1},{"x":4,"y":0}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":1,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":2,"y":2},{"x":3,"y":1},{"x":4,"y":0}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":1,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":1,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":2,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":2,"y":2},{"x":3,"y":1},{"x":4,"y":0}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":2,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":1,"y":1},{"x":1,"y":2},{"x":2,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":3,"y":1},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":1},{"x":0,"y":0},{"x":0,"y":1}],[{"x":2,"y":1},{"x":3,"y":1},{"x":4,"y":0}],[{"x":0,"y":0},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":3,"y":1},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":1}],[{"x":2,"y":1},{"x":3,"y":1},{"x":4,"y":0}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":3,"y":1},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":4,"y":0}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":3,"y":1},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":1},{"x":1,"y":2},{"x":2,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":4,"y":0}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":3,"y":1},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":3}],[{"x":2,"y":1},{"x":3,"y":1},{"x":4,"y":0}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":3,"y":1},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":1},{"x":1,"y":2},{"x":1,"y":3}],[{"x":2,"y":1},{"x":3,"y":1},{"x":4,"y":0}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":3,"y":1},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":1},{"x":1,"y":2},{"x":2,"y":3}],[{"x":2,"y":1},{"x":3,"y":1},{"x":4,"y":0}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":3,"y":1},{"x":2,"y":1},{"x":3,"y":1}],[{"x":1,"y":0},{"x":0,"y":1},{"x":1,"y":2}],[{"x":2,"y":1},{"x":2,"y":2},{"x":1,"y":2}],[{"x":0,"y":1},{"x":1,"y":0},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":1}],[{"x":3,"y":1},{"x":2,"y":2},{"x":2,"y":1}],[{"x":1,"y":0},{"x":0,"y":1},{"x":0,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":1,"y":0}],[{"x":0,"y":1},{"x":1,"y":0},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":0},{"x":0,"y":1}],[{"x":3,"y":1},{"x":2,"y":2},{"x":2,"y":1}],[{"x":1,"y":0},{"x":2,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":2,"y":1}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":2,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":2,"y":1}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":3,"y":1},{"x":2,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":2,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":1,"y":2}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":2,"y":1}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":3,"y":1},{"x":2,"y":1}],[{"x":2,"y":2},{"x":3,"y":2},{"x":2,"y":2}],[{"x":1,"y":1},{"x":2,"y":1},{"x":2,"y":0}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":2,"y":2}],[{"x":3,"y":1},{"x":2,"y":2},{"x":2,"y":1}],[{"x":3,"y":2},{"x":2,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":2,"y":2}],[{"x":3,"y":1},{"x":2,"y":2},{"x":2,"y":1}],[{"x":3,"y":2},{"x":3,"y":1},{"x":2,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":2,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":1,"y":2}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":4,"y":2}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":2,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":4,"y":2}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":3,"y":1},{"x":2,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":2,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":1,"y":2}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":2,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":2,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":2,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":3,"y":1},{"x":2,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":2,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":1,"y":2}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":3,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":2,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":3,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":3,"y":1},{"x":2,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":2,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":1,"y":2}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":4,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":2,"y":1},{"x":1,"y":2}],[{"x":2,"y":2},{"x":1,"y":3},{"x":1,"y":2}],[{"x":2,"y":1},{"x":3,"y":1},{"x":2,"y":0}]],
    [[{"x":2,"y":1},{"x":3,"y":2},{"x":4,"y":3}],[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":1}],[{"x":3,"y":2},{"x":3,"y":1},{"x":2,"y":0}],[{"x":2,"y":2},{"x":2,"y":1},{"x":2,"y":0}],[{"x":3,"y":1},{"x":2,"y":2},{"x":1,"y":2}]],
  ],
  'JEJJGJACAEAAAFDGADAAAGAAA': [
    [[{"x":2,"y":1},{"x":1,"y":2},{"x":2,"y":3}],[{"x":4,"y":1},{"x":4,"y":0},{"x":4,"y":1}],[{"x":1,"y":2},{"x":2,"y":1},{"x":3,"y":0}],[{"x":4,"y":0},{"x":4,"y":1},{"x":4,"y":0}],[{"x":2,"y":1},{"x":3,"y":1},{"x":4,"y":0}],[{"x":1,"y":0},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":2},{"x":2,"y":3},{"x":1,"y":4}]],
    [[{"x":2,"y":1},{"x":2,"y":2},{"x":2,"y":3}],[{"x":4,"y":1},{"x":4,"y":0},{"x":4,"y":1}],[{"x":2,"y":2},{"x":2,"y":1},{"x":3,"y":0}],[{"x":4,"y":0},{"x":4,"y":1},{"x":4,"y":0}],[{"x":2,"y":1},{"x":3,"y":1},{"x":4,"y":0}],[{"x":1,"y":0},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":2},{"x":2,"y":3},{"x":1,"y":4}]],
  ],
  'AGADAIACAADBAAAAADAAAAAED': [
    [[{"x":0,"y":1},{"x":1,"y":0},{"x":0,"y":0}],[{"x":1,"y":2},{"x":1,"y":1},{"x":2,"y":0}],[{"x":1,"y":0},{"x":0,"y":1},{"x":0,"y":0}],[{"x":1,"y":1},{"x":2,"y":0},{"x":3,"y":0}],[{"x":0,"y":1},{"x":0,"y":0},{"x":1,"y":0}],[{"x":2,"y":0},{"x":1,"y":1},{"x":1,"y":0}],[{"x":0,"y":0},{"x":0,"y":1},{"x":0,"y":0}]],
    [[{"x":2,"y":1},{"x":1,"y":1},{"x":0,"y":2}],[{"x":1,"y":2},{"x":2,"y":1},{"x":2,"y":2}],[{"x":1,"y":1},{"x":2,"y":2},{"x":1,"y":1}],[{"x":3,"y":4},{"x":2,"y":3},{"x":1,"y":3}],[{"x":0,"y":1},{"x":0,"y":2},{"x":1,"y":1}],[{"x":2,"y":1},{"x":2,"y":0},{"x":3,"y":0}],[{"x":2,"y":2},{"x":1,"y":2},{"x":0,"y":1}]],
    [[{"x":2,"y":1},{"x":1,"y":1},{"x":0,"y":2}],[{"x":1,"y":2},{"x":2,"y":1},{"x":2,"y":2}],[{"x":1,"y":1},{"x":2,"y":2},{"x":1,"y":1}],[{"x":3,"y":4},{"x":2,"y":3},{"x":1,"y":3}],[{"x":2,"y":2},{"x":1,"y":2},{"x":1,"y":1}],[{"x":2,"y":1},{"x":2,"y":2},{"x":2,"y":1}],[{"x":0,"y":1},{"x":1,"y":1},{"x":0,"y":1}]],
  ],
  'DJDDAAGJCAADBEAGAAIAADAGD': [
    [[{"x":3,"y":1},{"x":2,"y":0},{"x":3,"y":0}],[{"x":2,"y":2},{"x":1,"y":2},{"x":2,"y":1}],[{"x":2,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":1,"y":2},{"x":0,"y":1},{"x":1,"y":0}],[{"x":3,"y":3},{"x":2,"y":2},{"x":3,"y":3}],[{"x":3,"y":2},{"x":3,"y":1},{"x":4,"y":0}],[{"x":1,"y":1},{"x":2,"y":0},{"x":1,"y":1}],[{"x":0,"y":1},{"x":0,"y":0},{"x":1,"y":1}],[{"x":2,"y":0},{"x":3,"y":0},{"x":2,"y":0}]],
    [[{"x":3,"y":1},{"x":2,"y":0},{"x":3,"y":0}],[{"x":2,"y":2},{"x":1,"y":2},{"x":2,"y":1}],[{"x":2,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":1,"y":2},{"x":0,"y":1},{"x":1,"y":0}],[{"x":3,"y":3},{"x":4,"y":2},{"x":3,"y":3}],[{"x":3,"y":2},{"x":3,"y":1},{"x":3,"y":2}],[{"x":1,"y":1},{"x":2,"y":0},{"x":1,"y":1}],[{"x":0,"y":1},{"x":0,"y":0},{"x":1,"y":1}],[{"x":2,"y":0},{"x":3,"y":0},{"x":2,"y":0}]],
    [[{"x":3,"y":1},{"x":2,"y":0},{"x":3,"y":0}],[{"x":2,"y":2},{"x":1,"y":2},{"x":2,"y":1}],[{"x":2,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":1,"y":2},{"x":0,"y":1},{"x":1,"y":0}],[{"x":3,"y":3},{"x":3,"y":4},{"x":4,"y":4}],[{"x":0,"y":1},{"x":1,"y":2},{"x":0,"y":1}],[{"x":1,"y":1},{"x":2,"y":0},{"x":3,"y":0}],[{"x":3,"y":2},{"x":4,"y":1},{"x":3,"y":0}],[{"x":3,"y":4},{"x":3,"y":3},{"x":4,"y":4}]],
    [[{"x":3,"y":1},{"x":2,"y":0},{"x":3,"y":0}],[{"x":2,"y":2},{"x":1,"y":2},{"x":2,"y":1}],[{"x":2,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":1,"y":2},{"x":0,"y":1},{"x":1,"y":0}],[{"x":3,"y":3},{"x":3,"y":4},{"x":4,"y":4}],[{"x":0,"y":1},{"x":1,"y":2},{"x":0,"y":1}],[{"x":3,"y":4},{"x":3,"y":3},{"x":4,"y":4}],[{"x":3,"y":2},{"x":4,"y":3},{"x":4,"y":4}],[{"x":1,"y":1},{"x":2,"y":0},{"x":3,"y":0}]],
    [[{"x":3,"y":1},{"x":2,"y":0},{"x":3,"y":1}],[{"x":2,"y":2},{"x":1,"y":2},{"x":2,"y":1}],[{"x":2,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":1,"y":2},{"x":0,"y":1},{"x":1,"y":0}],[{"x":1,"y":1},{"x":2,"y":0},{"x":3,"y":1}],[{"x":0,"y":1},{"x":1,"y":2},{"x":2,"y":2}],[{"x":3,"y":3},{"x":2,"y":2},{"x":1,"y":1}],[{"x":1,"y":2},{"x":0,"y":1},{"x":1,"y":1}],[{"x":2,"y":0},{"x":3,"y":1},{"x":2,"y":0}]],
  ],
  'ABJDAAACFAAAAAAEAAAADAAAA': [
    [[{"x":3,"y":1},{"x":3,"y":0},{"x":3,"y":1}],[{"x":1,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":3,"y":0},{"x":3,"y":1},{"x":3,"y":0}],[{"x":1,"y":1},{"x":2,"y":2},{"x":1,"y":1}],[{"x":2,"y":1},{"x":3,"y":2},{"x":2,"y":1}],[{"x":2,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":2},{"x":2,"y":1},{"x":3,"y":0}]],
    [[{"x":3,"y":1},{"x":3,"y":0},{"x":3,"y":1}],[{"x":1,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":3,"y":0},{"x":3,"y":1},{"x":3,"y":0}],[{"x":1,"y":1},{"x":2,"y":2},{"x":1,"y":1}],[{"x":2,"y":1},{"x":3,"y":2},{"x":4,"y":1}],[{"x":2,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":2},{"x":2,"y":1},{"x":3,"y":0}]],
    [[{"x":3,"y":1},{"x":3,"y":0},{"x":3,"y":1}],[{"x":1,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":3,"y":0},{"x":3,"y":1},{"x":3,"y":0}],[{"x":1,"y":1},{"x":2,"y":2},{"x":1,"y":1}],[{"x":2,"y":1},{"x":3,"y":2},{"x":4,"y":2}],[{"x":2,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":2},{"x":2,"y":1},{"x":3,"y":0}]],
    [[{"x":3,"y":1},{"x":3,"y":0},{"x":3,"y":1}],[{"x":1,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":3,"y":0},{"x":3,"y":1},{"x":3,"y":0}],[{"x":1,"y":1},{"x":2,"y":2},{"x":1,"y":1}],[{"x":2,"y":1},{"x":3,"y":2},{"x":2,"y":3}],[{"x":2,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":2},{"x":2,"y":1},{"x":3,"y":0}]],
    [[{"x":3,"y":1},{"x":3,"y":0},{"x":3,"y":1}],[{"x":1,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":3,"y":0},{"x":3,"y":1},{"x":3,"y":0}],[{"x":1,"y":1},{"x":2,"y":2},{"x":1,"y":1}],[{"x":2,"y":1},{"x":3,"y":2},{"x":3,"y":3}],[{"x":2,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":2},{"x":2,"y":1},{"x":3,"y":0}]],
    [[{"x":3,"y":1},{"x":3,"y":0},{"x":3,"y":1}],[{"x":1,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":3,"y":0},{"x":3,"y":1},{"x":3,"y":0}],[{"x":1,"y":1},{"x":2,"y":2},{"x":1,"y":1}],[{"x":2,"y":1},{"x":3,"y":2},{"x":4,"y":3}],[{"x":2,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":2},{"x":2,"y":1},{"x":3,"y":0}]],
    [[{"x":3,"y":1},{"x":4,"y":0},{"x":3,"y":0}],[{"x":1,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":4,"y":0},{"x":3,"y":1},{"x":3,"y":2}],[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":1}],[{"x":3,"y":1},{"x":3,"y":0},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":0},{"x":3,"y":1},{"x":3,"y":0}]],
    [[{"x":3,"y":1},{"x":4,"y":1},{"x":3,"y":0}],[{"x":1,"y":0},{"x":1,"y":1},{"x":2,"y":0}],[{"x":4,"y":1},{"x":3,"y":1},{"x":3,"y":2}],[{"x":1,"y":1},{"x":1,"y":2},{"x":0,"y":1}],[{"x":3,"y":1},{"x":3,"y":0},{"x":3,"y":1}],[{"x":1,"y":2},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":0},{"x":3,"y":1},{"x":3,"y":0}]],
    [[{"x":3,"y":1},{"x":2,"y":2},{"x":3,"y":2}],[{"x":1,"y":0},{"x":0,"y":0},{"x":1,"y":0}],[{"x":2,"y":2},{"x":3,"y":1},{"x":3,"y":0}],[{"x":0,"y":0},{"x":1,"y":1},{"x":0,"y":0}],[{"x":3,"y":1},{"x":3,"y":0},{"x":3,"y":1}],[{"x":1,"y":1},{"x":1,"y":0},{"x":2,"y":0}],[{"x":3,"y":0},{"x":3,"y":1},{"x":3,"y":0}]],
  ],
}[puzzle.position];
console.log(`Solving ${puzzle.position} (#${MinimumGame.fromPosition(puzzle.position).hash}) with depth ${puzzle.maxDepth}, ${expectedHistoryMoves ? `expecting ${expectedHistoryMoves.length} solutions` : 'without knowing how many solutions are there'}`);
ss1=MinimumGame.solvePosition({...puzzle, usePool: true});
const allHistoryMoves = (ss1.root.leaves || []).map(game => game.historyFullMoves);
if (expectedHistoryMoves) {
  const missingMoves = _.differenceBy(Array.from(new Set(expectedHistoryMoves)), Array.from(new Set(allHistoryMoves)), historyMoves => JSON.stringify(historyMoves));
  const extraMoves = _.differenceBy(Array.from(new Set(allHistoryMoves)), Array.from(new Set(expectedHistoryMoves)), historyMoves => JSON.stringify(historyMoves));
  if (missingMoves.length || extraMoves.length) {
    throw new Error(`Wrong set of moves returned: ${missingMoves.length} are missing, and ${extraMoves.length} are added`);
  } else {
    console.log(`Found ${allHistoryMoves.length} solutions, as expected`);
  }
} else {
  console.log(`Found ${allHistoryMoves.length} solutions`);
  console.log(JSON.stringify(allHistoryMoves));
}
