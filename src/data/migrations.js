const {Game} = require('../game/game');
const _ = require('lodash');
const moment = require('moment');

const migrations = [];

const addMigration = migration => {
  if (!migration.description) {
    throw new Error("Migration needs to have a `description`");
  }
  if (!migration.migrate || typeof migration.migrate !== typeof function(){}) {
    throw new Error("Migration must have a function as `migrate`")
  }
  if (!migration.fromVersion && migration.fromVersion !== 0) {
    if (!migrations.length) {
      throw new Error("First migration must specify `fromVersion`");
    }
    const lastVersion = migrations[migrations.length - 1].toVersion;
    if (typeof lastVersion !== typeof 0 || isNaN(lastVersion)) {
      throw new Error("Last migration `toVersion` is not a number");
    }
    migration.fromVersion = lastVersion;
  }
  if (typeof migration.fromVersion !== typeof 0 || isNaN(migration.fromVersion)) {
    throw new Error("Migration must have a number as `fromVersion`");
  }
  if (!migration.toVersion) {
    migration.toVersion = migration.fromVersion + 1;
  }
  if (typeof migration.toVersion !== typeof 0 || isNaN(migration.toVersion)) {
    throw new Error("Migration must have a number as `toVersion`");
  }
  migrations.push(migration);
};

module.exports = {};

const migrate = module.exports.migrate = (data) => {
  let migrated = false;
  data.version = data.version || 0;
  console.log('checking for migrations from version', data.version);
  for (const migration of migrations) {
    if (migration.fromVersion === data.version) {
      console.log('migrating', {from: data.version, to: migration.toVersion, description: migration.description});
      migration.migrate(data);
      data.version = migration.toVersion;
      migrated = true;
    }
  }

  console.log('data are now version', data.version);

  return migrated;
};

// Initial data with version = 0
const getInitialData = module.exports.getInitialData = () => {
  return {users: {}, games: {}};
};

addMigration({
  fromVersion: 0,
  description: "Use more compact game representation",
  migrate: data => {
    for (const game of Object.values(data.games)) {
      game.serializedGame = Game.deserialize(game.serializedGame).serialize();
    }
  },
});

addMigration({
  description: "Save data with a more compact format",
  migrate: data => {
    data.users = Object.values(data.users);
    data.games = Object.values(data.games);
  },
});

addMigration({
  description: "Add user settings",
  migrate: data => {
    for (const user of data.users) {
      user.settings = {
        autoSubmitMoves: false,
        theme: {scheme: '', rotated: false, rounded: false, numbers: ''},
      };
    }
  },
});

addMigration({
  description: "Add 'enableNotifications' to user settings",
  migrate: data => {
    for (const user of data.users) {
      user.settings.enableNotifications = true;
    }
  },
});

addMigration({
  description: "Export `game.nextUserId`",
  migrate: data => {
    for (const game of data.games) {
      const gameGame = Game.deserialize(game.serializedGame);
      game.nextUserId = gameGame.nextPlayer === Game.PLAYER_A ? game.userIds[0] : gameGame.nextPlayer === Game.PLAYER_B ? game.userIds[1] : null;
    }
  },
});

addMigration({
  description: "Add game dates",
  migrate: data => {
    for (const game of data.games) {
      const gameGame = Game.deserialize(game.serializedGame);
      let lastDatetime = moment('2019-08-13T12:00:00.000Z');
      game.startDatetime = lastDatetime;
      game.movesDatetimes = gameGame.moves.map(() => {
        lastDatetime = lastDatetime.clone().add(5, 'second');
        return lastDatetime;
      });
      if (game.finished) {
        game.endDatetime = lastDatetime;
      } else {
        game.endDatetime = null;
      }
    }
  },
});

addMigration({
  description: "Convert password to token",
  migrate: data => {
    for (const user of data.users) {
      user.token = user.password;
      delete user.password;
    }
  },
});

addMigration({
  description: "Add password hash",
  migrate: data => {
    for (const user of data.users) {
      user.passwordHash = null;
    }
  },
});

addMigration({
  description: "Track merged users",
  migrate: data => {
    data.mergedUsersMap = {
      // Brook
      '99ed3a92-0b1a-44c5-8de2-f70221653167': '525e4e0b-1003-4fd0-acaf-3edd66a6c9c4',
      // Tom
      'e21b20ee-2615-491c-8e81-f2b5ce90c4a3': '4c5aeed6-f275-4b8f-9cb5-50000f45b4ca',
      'b8586d00-bb29-4ab9-9acd-778a311ae257': '4c5aeed6-f275-4b8f-9cb5-50000f45b4ca',
      // Thanos
      'cdd922cf-804d-495b-890c-6cdd480ba718': '133acdf2-87f0-40f4-9b6a-cf22d7cc8eab',
    };
    for (const game of data.games) {
      game.userIds = game.userIds.map(id => id in data.mergedUsersMap ? data.mergedUsersMap[id] : id)
      game.nextUserId = game.nextUserId in data.mergedUsersMap ? data.mergedUsersMap[game.nextUserId] : game.nextUserId;
    }
  },
});

addMigration({
  description: "Track Elo score",
  migrate: data => {
    // noinspection DuplicatedCode
    const getEloKFactor = player => {
      if (player.gameCount < 30 && player.maxScore < 2300) {
        return 40;
      }
      if (player.maxScore < 2400) {
        return 20;
      }

      return 10;
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

    for (const user of data.users) {
      Object.assign(user, {
        score: 1200,
        maxScore: 1200,
        gameCount: 0,
      });
    }

    const getEloPlayerScoreData = player => {
      return _.pick(player, ['id', 'score', 'maxScore', 'gameCount']);
    };

    const usersById = _.fromPairs(data.users.map(user => [user.id, user]));

    const sortedGames = _.sortBy(data.games, ['startDatetime', 'id']);
    for (const game of sortedGames) {
      const [playerAId, playerBId] = game.userIds;
      const playerA = usersById[playerAId];
      const playerB = usersById[playerBId];
      game.initialPlayerA = getEloPlayerScoreData(playerA);
      game.initialPlayerB = getEloPlayerScoreData(playerB);
      if (!game.finished) {
        continue;
      }
      const [newPlayerAScore, newPlayerBScore] = scoreGame(
        game.winnerUserId === playerAId, game.initialPlayerA, game.initialPlayerB);
      game.resultingPlayerAScore = newPlayerAScore.score;
      game.resultingPlayerBScore = newPlayerBScore.score;
      Object.assign(playerA, newPlayerAScore);
      Object.assign(playerB, newPlayerBScore);
    }
  },
});

addMigration({
  description: "Fix game.winnerUserId",
  migrate: data => {
    for (const game of data.games) {
      game.winnerUserId = game.winnerUserId in data.mergedUsersMap ? data.mergedUsersMap[game.winnerUserId] : game.winnerUserId;
    }
  },
});

addMigration({
  description: "Track win count",
  migrate: data => {
    for (const user of data.users) {
      user.winCount = 0;
    }
    const usersById = _.fromPairs(data.users.map(user => [user.id, user]));
    for (const game of data.games) {
      if (!game.finished) {
        continue;
      }
      let user;
      if (game.winnerUserId === game.userIds[0]) {
        user = usersById[game.userIds[0]];
      } else if (game.winnerUserId === game.userIds[1]) {
        user = usersById[game.userIds[1]];
      } else {
        throw new Error("User not found", game.winnerUserId);
      }
      user.winCount += 1;
    }
  },
});

addMigration({
  description: "Properly track Elo score",
  migrate: data => {
    // noinspection DuplicatedCode
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

    const equalRound = number => {
      return Math.sign(number) * Math.round(Math.abs(number))
    };

    const getScoreDifferences = (aWon, playerA, playerB) => {
      const kA = getEloKFactor(playerA);
      const kB = getEloKFactor(playerB);

      const expectedA = getEloExpectedScore(playerA, playerB);
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

    for (const user of data.users) {
      Object.assign(user, {
        score: 1200,
        maxScore: 1200,
        winCount: 0,
        gameCount: 0,
      });
    }

    const usersById = _.fromPairs(data.users.map(user => [user.id, user]));

    const sortedGames = _.sortBy(data.games, ['startDatetime', 'id']);
    for (const game of sortedGames) {
      const [playerAId, playerBId] = game.userIds;
      const playerA = usersById[playerAId];
      const playerB = usersById[playerBId];
      game.initialPlayerA = getEloPlayerScoreData(playerA, playerB);
      game.initialPlayerB = getEloPlayerScoreData(playerB, playerA);
      game.resultingPlayerAScore = null;
      game.resultingPlayerBScore = null;
      game.resultingPlayerAScoreDifference = null;
      game.resultingPlayerBScoreDifference = null;
      if (!game.finished) {
        continue;
      }
      const playerAWon = game.winnerUserId === playerA.id;
      const [newPlayerAScore, newPlayerBScore, newGame] = scoreGame(
        playerAWon, game.initialPlayerA, game.initialPlayerB, playerA, playerB);
      Object.assign(game, newGame);
      Object.assign(playerA, newPlayerAScore);
      Object.assign(playerB, newPlayerBScore);
    }
  },
});

addMigration({
  description: "Update user settings",
  migrate: data => {
    for (const user of data.users) {
      user.settings = {
        ...user.settings,
        theme: {
          ..._.omit(user.settings.theme, ['rotated', 'rounded']),
          pieces: 'king', rotateOpponent: true,
        },
      };
    }
  },
});

addMigration({
  description: "More user settings",
  migrate: data => {
    for (const user of data.users) {
      user.settings = {
        ...user.settings,
        theme: {
          ...user.settings.theme,
          animations: true, arrows: true,
        },
      };
    }
  },
});

addMigration({
  description: "Add tournaments",
  migrate: data => {
    data.tournaments = [];
    for (const game of data.games) {
      game.tournamentId = null;
    }
    for (const user of data.users) {
      Object.assign(user, {
        tournamentCount: 0,
        tournamentWinCount: 0,
      });
    }
  },
});

addMigration({
  description: "Use check for winning",
  migrate: data => {
    for (const game of data.games) {
      game.serializedGame.useCheck = true;
      let gameGame;
      try {
        gameGame = Game.deserialize(game.serializedGame);
        continue;
      } catch (e) {
      }
      let moves = game.serializedGame.moves.slice();
      while (moves.length) {
        moves = moves.slice(0, moves.length - 1);
        try {
          gameGame = Game.deserialize({...game.serializedGame, moves});
          if (Game.MOVE_TYPES_START_OF_TURN.includes(gameGame.moveType)) {
            break;
          }
        } catch (e) {
        }
      }
      console.log('Game', game.id, 'had', game.serializedGame.moves.length - moves.length, 'moves removed');
      if (!gameGame.finished) {
        moves = moves.concat([{resign: gameGame.nextPlayer}]);
        gameGame = Game.deserialize({...game.serializedGame, moves});
        console.log('Game', game.id, 'had player resigned instead of making illegal move');
      }
      const winner = gameGame.winner;
      const expectedWinner = game.winnerUserId;
      const gameWinner = {[Game.PLAYER_A]: game.userIds[0], [Game.PLAYER_B]: game.userIds[1]}[winner];
      if (expectedWinner === gameWinner) {
        game.serializedGame.moves = moves;
        continue;
      }
      throw new Error(`Game ${game.id}, cannot use check: unexpected winner`);
    }
  },
});

addMigration({
  description: "Remove `useCheck`",
  migrate: data => {
    for (const game of data.games) {
      delete game.serializedGame.useCheck;
    }
  },
});

addMigration({
  description: "Add challenges",
  migrate: data => {
    data.challenges = [];
  },
});

addMigration({
  description: "Add user challenges",
  migrate: data => {
    for (const user of data.users) {
      user.challenges = {};
    }
  },
});

addMigration({
  description: "Add more challenges meta fields",
  migrate: data => {
    for (const challenge of data.challenges) {
      challenge.meta.public = true;
      challenge.meta.publishDatetime = challenge.meta.createdDatetime;
    }
  },
});

addMigration({
  description: "Add user setting confirmSubmitMoves",
  migrate: data => {
    for (const user of data.users) {
      user.settings.confirmSubmitMoves = true;
    }
  },
});

addMigration({
  description: "Add user setting `theme.cells`",
  migrate: data => {
    for (const user of data.users) {
      user.settings.theme.cells = 'original';
    }
  },
});

addMigration({
  description: "Add user setting `theme.useTopicalTheme`",
  migrate: data => {
    for (const user of data.users) {
      user.settings.theme.useTopicalTheme = true;
    }
  },
});

addMigration({
  description: "Add admins",
  migrate: data => {
    for (const user of data.users) {
      user.admin = user.id === '5c8475c8-5dd8-4a05-914b-809e91b1deac';
    }
  },
});

addMigration({
  description: "Add user challenges stats",
  migrate: data => {
    const challengesById = _.fromPairs(data.challenges.map(challenge => [challenge.id, challenge]));
    for (const user of data.users) {
      const userChallenges = Object.values(user.challenges);
      user.challengesStats = {
        perfect: userChallenges
          .filter(userChallenge => userChallenge.meta.won && !userChallenge.meta.mistakes)
          .length,
        imperfect: userChallenges
          .filter(userChallenge => userChallenge.meta.won)
          .length,
        attempted: userChallenges
          .length,
        perfectStars: _.sum(Object.entries(user.challenges)
          .filter(([, userChallenge]) => userChallenge.meta.won && !userChallenge.meta.mistakes)
          .map(([challengeId]) => challengesById[challengeId].meta.difficulty)),
      };
    }
  },
});

addMigration({
  description: "Add challenge users stats",
  migrate: data => {
    const users = data.users;
    for (const challenge of data.challenges) {
      const userChallenges = users
        .map(user => [user.challenges[challenge.id], user])
        .filter(([userChallenge]) => userChallenge);
      challenge.usersStats = {
        perfect: userChallenges
          .filter(([userChallenge]) => userChallenge.meta.won && !userChallenge.meta.mistakes)
          .length,
        imperfect: userChallenges
          .filter(([userChallenge]) => userChallenge.meta.won)
          .length,
        attempted: userChallenges
          .length,
        averagePerfectScore: parseInt(_.mean(userChallenges
          .filter(([userChallenge]) => userChallenge.meta.won && !userChallenge.meta.mistakes)
          .map(([, user]) => user.score)).toFixed(), 10),
      };
    }
  },
});

addMigration({
  description: "Add challenge game link",
  migrate: data => {
    for (const challenge of data.challenges) {
      challenge.meta.gameId = null;
    }
  },
});
