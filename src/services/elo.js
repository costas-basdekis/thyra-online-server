const _ = require('lodash');

const getEloKFactor = player => {
  if (isUserRatingProvisional(player)) {
    return 40;
  }
  if (player.maxScore < 2400) {
    return 20;
  }

  return 10;
};

const isUserRatingProvisional = player => {
  return player.gameCount < 30 && player.maxScore < 2300;
};

const getEloExpectedScore = (playerA, playerB) => {
  return 1 / (1 + 10 ** ((playerB.score - playerA.score) / 400));
};

const scoreGame = (aWon, playerA, playerB) => {
  const kA = getEloKFactor(playerA);
  const kB = getEloKFactor(playerB);

  const expectedA = getEloExpectedScore(playerA, playerB);
  const expectedB = 1 - expectedA;
  const actualA = aWon ? 1 : 0;
  const actualB = 1 - actualA;

  const newScoreA = Math.floor(playerA.score + kA * (actualA - expectedA));
  const newScoreB = Math.floor(playerB.score + kB * (actualB - expectedB));

  const newPlayerA = {
    score: newScoreA,
    gameCount: playerA.gameCount + 1,
    maxScore: Math.max(playerA.score, newScoreA),
  };
  const newPlayerB = {
    score: newScoreB,
    gameCount: playerB.gameCount + 1,
    maxScore: Math.max(playerB.score, newScoreB),
  };

  return [newPlayerA, newPlayerB];
};

const getEloPlayerScoreData = player => {
  return _.pick(player, ['id', 'score', 'maxScore', 'gameCount']);
};

module.exports = {
  getEloKFactor, isUserRatingProvisional, getEloExpectedScore, scoreGame, getEloPlayerScoreData,
};
