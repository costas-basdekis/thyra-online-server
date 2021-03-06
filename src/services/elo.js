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

const getEloExpectedScore = (playerA, players) => {
  return _.sum(players.map(player => 1 / (1 + 10 ** ((player.score - playerA.score) / 400))));
};

const equalRound = number => {
  return Math.sign(number) * Math.round(Math.abs(number))
};

const getScoreDifferences = (aWon, playerA, playerB) => {
  const kA = getEloKFactor(playerA);
  const kB = getEloKFactor(playerB);

  const expectedA = getEloExpectedScore(playerA, [playerB]);
  const expectedB = 1 - expectedA;
  const actualA = aWon ? 1 : 0;
  const actualB = 1 - actualA;

  const scoreDifferenceA = equalRound(kA * (actualA - expectedA));
  const scoreDifferenceB = equalRound(kB * (actualB - expectedB));
  return [scoreDifferenceA, scoreDifferenceB];
};

const scoreGame = (aWon, initialPlayerA, initialPlayerB, playerA, playerB) => {
  const newScoreA = playerA.score + (aWon ? initialPlayerA.winPoints : initialPlayerA.losePoints);
  const newScoreB = playerB.score + (aWon ? initialPlayerB.losePoints : initialPlayerB.winPoints);

  const newPlayerA = {
    score: newScoreA,
    gameCount: playerA.gameCount + 1,
    winCount: playerA.winCount + (aWon ? 1 : 0),
    maxScore: Math.max(playerA.score, newScoreA),
  };
  const newPlayerB = {
    score: newScoreB,
    gameCount: playerB.gameCount + 1,
    winCount: playerB.winCount + (aWon ? 0 : 1),
    maxScore: Math.max(playerB.score, newScoreB),
  };
  const newGame = {
      resultingPlayerAScore: newPlayerA.score,
      resultingPlayerBScore: newPlayerB.score,
      resultingPlayerAScoreDifference: newPlayerA.score - playerA.score,
      resultingPlayerBScoreDifference: newPlayerB.score - playerB.score,
  };

  return [newPlayerA, newPlayerB, newGame];
};

const getEloPlayerScoreData = (player, otherPlayer) => {
  const [winPoints] = getScoreDifferences(true, player, otherPlayer);
  const [losePoints] = getScoreDifferences(false, player, otherPlayer);
  return {
    ..._.pick(player, ['id', 'score', 'maxScore', 'gameCount']),
    winPoints, losePoints,
  };
};

const getEloPlayerTournamentScoreData = (player, players, gameCount) => {
  const expectedPoints = getEloExpectedScore(player, players.filter(otherPlayer => otherPlayer.id !== player.id));
  return {
    ..._.pick(player, ['id', 'score', 'maxScore', 'gameCount']),
    kFactor: getEloKFactor(player),
    expectedPoints: expectedPoints * gameCount,
  };
};

const scoreTournamentPlayer = (player, tournament) => {
  const {ratedPoints, initialScore, gameIds} = tournament.userStats[player.id];
  const scoreDifference = equalRound(initialScore.kFactor * (ratedPoints - initialScore.expectedPoints));
  const newScore = player.score + scoreDifference;
  const newPlayer = {
    score: newScore,
    gameCount: player.gameCount + gameIds.filter(id => id).length,
    winCount: player.winCount + ratedPoints,
    maxScore: Math.max(player.score, newScore),
    tournamentCount: player.tournamentCount + 1,
    tournamentWinCount: player.tournamentWinCount + (tournament.winnerUserId === player.id ? 1 : 0),
  };
  const newStats = {
    scoreDifference,
  };

  return [newPlayer, newStats];
};

module.exports = {
  getEloKFactor, isUserRatingProvisional, getEloExpectedScore, scoreGame, getEloPlayerScoreData,
  getEloPlayerTournamentScoreData, scoreTournamentPlayer,
};
