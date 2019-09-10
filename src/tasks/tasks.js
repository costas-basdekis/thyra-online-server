const {addTask, every} = require('./manager');

addTask({
  name: 'cleanupUsersAndGames',
  interval: every.hour,
  run: () => {
    const {model} = require('../data');
    model.cleanupUsersAndGames();
  },
});

addTask({
  name: 'resignOldGames',
  interval: every.hour,
  run: () => {
    const {model} = require('../data');
    model.resignOldGames();
  },
});
