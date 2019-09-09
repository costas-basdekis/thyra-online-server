const {io} = require('./io');

const emit = {
  askUserToReload: socket => {
    socket.emit('reload');
  },

  emitUser: ({id, name, token, online, readyToPlay, settings, sockets, passwordHash}) => {
    sockets.map(socket => socket.emit("user", {id, name, token, online, readyToPlay, settings, hasPassword: !!passwordHash}));
  },

  emitUsers: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("users", Object.values(globalData.users).map(({id, name, online, readyToPlay, settings}) => ({
      id,
      name,
      online,
      readyToPlay,
      settings
    })));
  },

  emitGames: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("games", Object.values(globalData.games).map(({
                                                                id, userIds, finished, winner, winnerUserId, nextUserId, serializedGame: game, move, chainCount,
                                                                startDatetime, endDatetime, movesDatetimes,
                                                              }) => ({
      id, userIds, finished, winner, winnerUserId, nextUserId, game, move, chainCount,
      startDatetime: startDatetime.toISOString(), endDatetime: endDatetime ? endDatetime.toISOString() : null,
      movesDatetimes: movesDatetimes.map(datetime => datetime.toISOString()),
    })));
  },
};

module.exports = emit;
