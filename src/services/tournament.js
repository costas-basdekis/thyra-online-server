const _ = require('lodash');

const createTournamentSchedule = (players, gameCount) => {
  const multiplePairingMatrix = createMultiplePairingMatrix(players.length, gameCount);
  return multiplePairingMatrix.map(
    round => round.map(
      ([playerA, playerB]) => [playerA !== null ? players[playerA].id : null, playerB !== null ? players[playerB].id : null]));
};

const createMultiplePairingMatrix = (playerCount, gameCount) => {
  const reversePairing = ([playerA, playerB]) => {
    if (playerA === null || playerB === null) {
      return [playerA, playerB];
    }
    return [playerB, playerA];
  };
  const reverseRoundPairings = round => {
    return round.map(reversePairing);
  };
  const pairingMatrix = createPairingMatrix(playerCount);
  const reversePairingMatrix = pairingMatrix.map(reverseRoundPairings);
  return _.flatten(_.range(gameCount).map(gameIndex => (gameIndex % 2 === 0) ? pairingMatrix : reversePairingMatrix));
};

const createPairingMatrix = playerCount => {
  const firstPlayer = 0;
  const allOtherPlayers = _.range(1, playerCount).concat((playerCount % 2 === 0) ? [] : [null]);
  const arrangePair = ([playerA, playerB]) => {
    if (playerA === null) {
      return [playerB, null];
    }
    if (playerB === null) {
      return [playerA, null];
    }
    [playerA, playerB] = [playerA, playerB].sort();
    if (((playerA + playerB) % 2) === 1) {
      return [playerA, playerB];
    } else {
      return [playerB, playerA];
    }
  };
  const rounds = [];
  for (const round of _.range(allOtherPlayers.length)) {
    const pairs = [];
    const secondPlayer = allOtherPlayers[round];
    const otherPlayers = allOtherPlayers.slice(round + 1).concat(allOtherPlayers.slice(0, round));
    pairs.push(arrangePair([firstPlayer, secondPlayer]));
    for (const index of _.range(otherPlayers.length / 2)) {
      pairs.push(arrangePair([otherPlayers[index], otherPlayers[otherPlayers.length - 1 - index]]));
    }
    rounds.push(pairs);
  }
  return rounds;
};

module.exports = {
  createTournamentSchedule, createMultiplePairingMatrix, createPairingMatrix,
};
