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
    users: Object.values(data.users).map(user => _.omit(user, ['sockets', 'online', 'readyToPlay'])),
    games: Object.values(data.games).map(game => Object.assign(_.omit(game, ['game']), {
      startDatetime: game.startDatetime.toISOString(),
      endDatetime: game.endDatetime ? game.endDatetime.toISOString() : null,
      movesDatetimes: game.movesDatetimes.map(datetime => datetime.toISOString()),
    })),
  };
};

const prepareDataFromLoad = dataFromLoad => {
  return {
    version: dataFromLoad.version,
    users: _.fromPairs(dataFromLoad.users.map(user => [user.id, {
      ...user,
      sockets: [],
      online: false,
      readyToPlay: false,
    }])),
    games: _.fromPairs(dataFromLoad.games.map(game => [game.id, {
      ...game,
      game: Game.deserialize(game.serializedGame),
      startDatetime: moment(game.startDatetime),
      endDatetime: game.endDatetime ? moment(game.endDatetime) : null,
      movesDatetimes: game.movesDatetimes.map(datetime => moment(datetime)),
    }])),
  };
};

const globalData = loadData();

module.exports = {
  saveData, loadData, globalData,
};
