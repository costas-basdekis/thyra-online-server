const elo = require('./elo');
const tournament = require('./tournament');

module.exports = {
  ...elo,
  ...tournament,

  elo,
  tournament,
};
