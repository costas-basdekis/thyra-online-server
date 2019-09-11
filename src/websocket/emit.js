const {io} = require('./io');
const _ = require('lodash');
const services = require('../services');

const emit = {
  askUserToReload: socket => {
    socket.emit('reload');
  },

  emitUser: (user) => {
    const serializedUser = {
      ..._.pick(user, ['id', 'name', 'token', 'online', 'readyToPlay', 'settings', 'score', 'gameCount', 'winCount']),
      hasPassword: !!user.passwordHash,
      isUserRatingProvisional: services.isUserRatingProvisional(user),
    };
    user.sockets.map(socket => socket.emit("user", serializedUser));
  },

  emitUsers: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("users", Object.values(globalData.users).map(user => ({
      ..._.pick(user, ['id', 'name', 'online', 'readyToPlay', 'score', 'gameCount', 'winCount']),
      isUserRatingProvisional: services.isUserRatingProvisional(user),
    })));
  },

  emitGames: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("games", Object.values(globalData.games).map(game => ({
      ..._.pick(game, [
        'id', 'userIds', 'finished', 'winner', 'winnerUserId', 'nextUserId', 'move', 'chainCount',
        'initialPlayerA', 'initialPlayerB', 'resultingPlayerAScore', 'resultingPlayerBScore',
      ]),
      game: game.serializedGame,
      startDatetime: game.startDatetime.toISOString(),
      endDatetime: game.endDatetime ? game.endDatetime.toISOString() : null,
      movesDatetimes: game.movesDatetimes.map(datetime => datetime.toISOString()),
    })));
  },
};

module.exports = emit;
