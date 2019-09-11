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
  fromVersion: 10,
  toVersion: 9,
  description: "Revert 'Track Elo score'",
  migrate: data => {},
});
