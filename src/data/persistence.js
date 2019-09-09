const {Game} = require('../game/game');
const {getInitialData, migrate} = require('./migrations');
const fs = require('fs');
const _ = require('lodash');
const moment = require('moment');

const saveData = (data = globalData) => {
  if (fs.existsSync('data.json')) {
    fs.copyFileSync('data.json', 'data.json.backup');
  }
  const dataForSave = prepareDataForSave(data);
  fs.writeFileSync('data.json', JSON.stringify(dataForSave));
  if (!fs.existsSync('data.json')) {
    console.error("Just wrote data but could not find the file");
    throw new Error("Just wrote data but could not find the file");
  }
};

const loadData = () => {
  let dataFromLoad;
  if (!fs.existsSync('data.json')) {
    dataFromLoad = getInitialData();
  } else {
    dataFromLoad = JSON.parse(fs.readFileSync('data.json'));
  }
  const migrated = migrate(dataFromLoad);
  const data = prepareDataFromLoad(dataFromLoad);
  if (migrated) {
    saveData(data);
  }
  return data;
};

const prepareDataForSave = data => {
  return {
    version: data.version,
    mergedUsersMap: data.mergedUsersMap,
    users: Object.values(data.users).map(user => _.omit(user, ['sockets', 'online', 'readyToPlay'])),
    games: Object.values(data.games).map(game => Object.assign(_.omit(game, ['game']), {
      startDatetime: game.startDatetime.toISOString(),
      endDatetime: game.endDatetime ? game.endDatetime.toISOString() : null,
      movesDatetimes: game.movesDatetimes.map(datetime => datetime.toISOString()),
    })),
  };
};

const prepareDataFromLoad = dataFromLoad => {
  let {users, games} = dataFromLoad;
  const originalGamesLength = games.length;
  games = games.filter(game => game.move >= 5);
  if (originalGamesLength !== games.length) {
    console.log('removed', originalGamesLength - games.length, 'not-started games');
  }
  const originalUsersLength = users.length;
  const userIdsWithGames = new Set(_.flatten(games.map(game => game.userIds)));
  users = users.filter(user => user.passwordHash || userIdsWithGames.has(user.id));
  if (users.length !== originalUsersLength) {
    console.log('removed', originalUsersLength - users.length, 'users with no games and no password');
  }

  const data = {
    version: dataFromLoad.version,
    mergedUsersMap: dataFromLoad.mergedUsersMap,
    users: _.fromPairs(users.map(user => [user.id, {
      ...user,
      sockets: [],
      online: false,
      readyToPlay: false,
    }])),
    games: _.fromPairs(games.map(game => [game.id, {
      ...game,
      game: Game.deserialize(game.serializedGame),
      startDatetime: moment(game.startDatetime),
      endDatetime: game.endDatetime ? moment(game.endDatetime) : null,
      movesDatetimes: game.movesDatetimes.map(datetime => moment(datetime)),
    }])),
  };

  return data;
};

const globalData = loadData();

module.exports = {
  saveData, loadData, globalData,
};
