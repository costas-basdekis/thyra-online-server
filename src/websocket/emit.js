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
        'tournamentCount', 'tournamentWinCount', 'challenges', 'admin',
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
        'tournamentWinCount', 'admin',
      ]),
      isUserRatingProvisional: services.isUserRatingProvisional(user),
    })));
  },

  emitGames: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("games", Object.values(globalData.games).map(game => ({
      ..._.pick(game, [
        'id', 'userIds', 'finished', 'winner', 'winnerUserId', 'nextUserId', 'move', 'chainCount',
        'initialPlayerA', 'initialPlayerB', 'resultingPlayerAScore', 'resultingPlayerBScore', 'tournamentId',
      ]),
      game: game.serializedGame,
      startDatetime: game.startDatetime.toISOString(),
      endDatetime: game.endDatetime ? game.endDatetime.toISOString() : null,
      movesDatetimes: game.movesDatetimes.map(datetime => datetime.toISOString()),
      tooShortToResign: model.isGameTooShortToResign(game),
    })));
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

  emitChallenges: (socket = io) => {
    const {persistence: {globalData}} = require("../data");
    socket.emit("challenges", Object.values(globalData.challenges)
      .filter(challenge => challenge.meta.public && challenge.meta.publishDatetime.isSameOrBefore())
      .map(challenge => ({
        ..._.pick(challenge, ['id', 'userId', 'options', 'meta']),
        startingPosition: _.pick(challenge.startingPosition, ['position']),
      })));
  },

  emitPersonalChallenges: (userIds = null) => {
    const {persistence: {globalData}} = require("../data");
    let personalChallenges = Object.values(globalData.challenges);
    if (userIds) {
      personalChallenges = personalChallenges.filter(challenge => userIds.includes(challenge.userId));
    }
    const personalChallengesByUserId = _.groupBy(personalChallenges, 'userId');
    for (const [userId, userPersonalChallenges] of Object.entries(personalChallengesByUserId)) {
      const user = globalData.users[userId];
      for (const socket of user.sockets) {
        socket.emit("personal-challenges", userPersonalChallenges
          .map(challenge => ({
            ..._.pick(challenge, ['id', 'userId', 'options', 'meta', 'startingPosition']),
            isMyChallenge: true,
          })));
      }
    }
  },
};

module.exports = emit;
