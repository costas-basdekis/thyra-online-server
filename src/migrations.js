const {Game} = require('./game/game');
const _ = require('lodash');

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