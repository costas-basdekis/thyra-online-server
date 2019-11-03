const {io} = require('./io');
const _ = require('lodash');
const services = require('../services');
const {model} = require('../data');

const emit = {
  askUserToReload: socket => {
    socket.emit('reload');
  },

  emitUser: (user) => {
    const serializedUser = {
      ..._.pick(user, [
        'id', 'name', 'token', 'online', 'readyToPlay', 'settings', 'score', 'gameCount', 'winCount',
        'tournamentCount', 'tournamentWinCount', 'puzzles', 'puzzlesStats', 'admin',
      ]),
      hasPassword: !!user.passwordHash,
      isUserRatingProvisional: services.isUserRatingProvisional(user),
    };
    user.sockets.map(socket => socket.emit("user", serializedUser));
  },

  emitUsers: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("users", Object.values(globalData.users).map(user => ({
      ..._.pick(user, [
        'id', 'name', 'online', 'readyToPlay', 'score', 'gameCount', 'winCount', 'tournamentCount',
        'tournamentWinCount', 'puzzlesStats', 'admin',
      ]),
      isUserRatingProvisional: services.isUserRatingProvisional(user),
    })));
  },


  emitGames: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("games", Object.values(globalData.games).map(emit.serializeGameForEmit));
  },

  emitGame: (game, socket = io) => {
    socket.emit("game", emit.serializeGameForEmit(game));
  },

  emitDeletedGame: (game, socket = io) => {
    socket.emit("deleted-game", game.id);
  },

  emitOpeningDatabase: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("opening-database", globalData.openingDatabase);
  },

  serializeGameForEmit: game => {
    return {
      ..._.pick(game, [
        'id', 'userIds', 'finished', 'winner', 'winnerUserId', 'nextUserId', 'move', 'chainCount',
        'initialPlayerA', 'initialPlayerB', 'resultingPlayerAScore', 'resultingPlayerBScore', 'tournamentId',
      ]),
      game: game.serializedGame,
      startDatetime: game.startDatetime.toISOString(),
      endDatetime: game.endDatetime ? game.endDatetime.toISOString() : null,
      movesDatetimes: game.movesDatetimes.map(datetime => datetime.toISOString()),
      tooShortToResign: model.isGameTooShortToResign(game),
    };
  },

  emitTournaments: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("tournaments", Object.values(globalData.tournaments).map(tournament => ({
      ..._.pick(tournament, [
        'id', 'name', 'creatorUserId', 'gameIds', 'userIds', 'winnerUserId', 'startDatetime', 'endDatetime',
        'createdDatetime', 'gameCount', 'round', 'rounds', 'started', 'finished', 'userStats', 'schedule',
      ]),
    })));
  },

  emitPuzzles: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("puzzles", Object.values(globalData.puzzles)
      .filter(puzzle => puzzle.meta.public && puzzle.meta.publishDatetime.isSameOrBefore())
      .map(puzzle => ({
        ..._.pick(puzzle, ['id', 'userId', 'options', 'meta', 'usersStats']),
        startingPosition: _.pick(puzzle.startingPosition, ['position']),
      })));
  },

  emitPersonalPuzzles: (userIds = null) => {
    const {persistence: {globalData}} = require("../data");
    let personalPuzzles = Object.values(globalData.puzzles);
    if (userIds) {
      personalPuzzles = personalPuzzles.filter(puzzle => userIds.includes(puzzle.userId));
    }
    const personalPuzzlesByUserId = _.groupBy(personalPuzzles, 'userId');
    for (const [userId, userPersonalPuzzles] of Object.entries(personalPuzzlesByUserId)) {
      const user = globalData.users[userId];
      for (const socket of user.sockets) {
        socket.emit("personal-puzzles", userPersonalPuzzles
          .map(puzzle => ({
            ..._.pick(puzzle, ['id', 'userId', 'options', 'meta', 'startingPosition', 'usersStats']),
            isMyPuzzle: true,
          })));
      }
    }
  },
};

module.exports = emit;
