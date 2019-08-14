const {Game} = require('./game/game');
const _ = require('lodash');
const moment = require('moment');

const migrations = [];

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

migrations.push({
  fromVersion: 0,
  toVersion: 1,
  description: "Use more compact game representation",
  migrate: data => {
    for (const game of Object.values(data.games)) {
      game.serializedGame = Game.deserialize(game.serializedGame).serialize();
    }
  },
});

migrations.push({
  fromVersion: 1,
  toVersion: 2,
  description: "Save data with a more compact format",
  migrate: data => {
    data.users = Object.values(data.users);
    data.games = Object.values(data.games);
  },
});

migrations.push({
  fromVersion: 2,
  toVersion: 3,
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

migrations.push({
  fromVersion: 3,
  toVersion: 4,
  description: "Add 'enableNotifications' to user settings",
  migrate: data => {
    for (const user of data.users) {
      user.settings.enableNotifications = true;
    }
  },
});

migrations.push({
  fromVersion: 4,
  toVersion: 5,
  description: "Export `game.nextUserId`",
  migrate: data => {
    for (const game of data.games) {
      const gameGame = Game.deserialize(game.serializedGame);
      game.nextUserId = gameGame.nextPlayer === Game.PLAYER_A ? game.userIds[0] : gameGame.nextPlayer === Game.PLAYER_B ? game.userIds[1] : null;
    }
  },
});

migrations.push({
  fromVersion: 5,
  toVersion: 6,
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
      }
    }
  },
});
