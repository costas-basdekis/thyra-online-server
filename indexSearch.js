const {MinimumGame} = require('./src/game/MinimumGame');

ss1=MinimumGame.solvePosition({position: 'DAGMGAICBEAGAAAAAAAAAAAAD', maxDepth: 5, usePool: true});
console.log(JSON.stringify(ss1.root.leaves.map(game => game.historyFullMoves)));
