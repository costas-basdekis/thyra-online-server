const uuid4 = require('uuid4');
const {Game} = require('../game/game');
const services = require('../services');
const {saveData, globalData} = require("./persistence");
const _ = require('lodash');
const moment = require('moment');
const bcrypt = require('bcrypt');

const reUuid4 = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;

const model = {
  createUser: (socket, extraData = {}) => {
    let id = extraData.id || uuid4();
    while (id in globalData.users) {
      id = uuid4();
    }
    const user = {
      id,
      name: extraData.name || `Guest ${id.slice(0, 4)}`,
      token: uuid4(),
      passwordHash: null,
      online: true,
      readyToPlay: false,
      settings: extraData.settings || {
        autoSubmitMoves: false,
        enableNotifications: false,
        theme: {pieces: 'king', scheme: '', rotateOpponent: true, numbers: 'obvious', animations: true, arrows: true},
      },
      sockets: [socket],
      score: 1200,
      maxScore: 1200,
      gameCount: 0,
      winCount: 0,
      tournamentCount: 0,
      tournamentWinCount: 0,
    };
    globalData.users[user.id] = user;
    saveData();

    return user;
  },

  loadUser: (id, socket) => {
    const user = globalData.users[id];
    user.online = true;
    user.sockets = user.sockets.includes(socket) ? user.sockets : user.sockets.concat([socket]);
    saveData();
    return user;
  },

  loadOrCreateUser: ({id, name, token, settings}, socket) => {
    let user, created;
    if (id && id in globalData.users && globalData.users[id].token === token) {
      user = model.loadUser(id, socket);
      console.log('existing user', _.pick(user, ['id', 'name']));
      created = false;
    } else if (id && id in globalData.mergedUsersMap) {
      user = model.loadUser(globalData.mergedUsersMap[id], socket);
      console.log('existing merged user', id, _.pick(user, ['id', 'name']));
      created = false;
    } else if (id && name && reUuid4.test(id) && !(id in globalData.users)) {
      user = model.createUser(socket, {id, name, settings});
      console.log('Created user', _.pick(user, ['id', 'name']));
      created = true;
    } else {
      user = model.createUser(socket, {name, settings});
      console.log('Created user', _.pick(user, ['id', 'name']));
      created = true;
    }
    saveData();
    const {emit} = require("../websocket");
    emit.emitUser(user);
    emit.emitUsers();
    emit.emitGames(socket);

    return [user, created];
  },

  logUserIn: async (name, password, mergeUsers, existingUser, socket) => {
    const usersWithName = Object.values(globalData.users).filter(user => user.name === name);
    if (!usersWithName) {
      console.log('no user to log in with name', name);
      return null;
    }
    let loggedInUser;
    for (const user of usersWithName) {
      if (await bcrypt.compare(password, user.passwordHash)) {
        loggedInUser = user;
        break
      }
    }
    if (!loggedInUser) {
      console.log('no password was correct');
      return null;
    }
    console.log('logged in user', _.pick(user, ['id', 'name']));
    if (existingUser && mergeUsers) {
      model.mergeUsers(existingUser, loggedInUser);
    }
    model.disconnectUser(existingUser, socket);
    loggedInUser = model.loadUser(loggedInUser.id, socket);
    const {emit} = require("../websocket");
    emit.emitUser(loggedInUser);
    emit.emitUsers();
    emit.emitGames(socket);

    return loggedInUser;
  },

  mergeUsers: (mergedUser, user) => {
    for (const game of Object.values(globalData.games)) {
      game.userIds = game.userIds.map(id => id === mergedUser.id ? user.id : id);
      game.nextUserId = game.nextUserId === mergedUser.id ? user.id : game.nextUserId;
      game.winnerUserId = game.winnerUserId === mergedUser.id ? user.id : game.winnerUserId;
    }
    for (const tournament of Object.values(globalData.tournaments)) {
      tournament.userIds = tournament.userIds.includes(mergedUser.id)
        ? tournament.userIds.map(userId => userId === mergedUser.id ? user.id : userId)
        : tournament.userIds;
      tournament.creatorUserId = tournament.creatorUserId === mergedUser.id ? user.id : tournament.creatorUserId;
      tournament.winnerUserId = tournament.winnerUserId === mergedUser.id ? user.id : tournament.winnerUserId;
      for (const round of tournament.schedule) {
        for (const pairing of round.pairings) {
          pairing.userIds = pairing.userIds.map(userId => userId === mergedUser.id ? user.id : userId);
        }
      }
    }
    delete globalData.users[mergedUser.id];
    const {emit} = require("../websocket");
    emit.emitUser(user);
    emit.emitUser(mergedUser);
    emit.emitUsers();
    emit.emitGames();
    emit.emitTournaments();
  },

  disconnectOrDeleteUser: (user, socket) => {
    const hasGames = !!Object.values(globalData.games).find(game => game.userIds.includes(user.id));
    const hasTournaments = !!Object.values(globalData.tournaments).find(tournament =>
      tournament.userIds.includes(user.id) || tournament.creatorUserId === user.id);
    if (user.passwordHash || hasGames || hasTournaments) {
      model.disconnectUser(user, socket);
    } else {
      model.deleteUser(user);
    }
  },

  disconnectUser: (user, socket) => {
    console.log("client disconnected", _.pick(user, 'id', 'name'));
    user.sockets = user.sockets.filter(otherSocket => otherSocket !== socket);
    user.online = user.sockets.length > 0;
    if (!user.online) {
      user.readyToPlay = false;
      console.log("user disconnected", _.pick(user, ['id', 'name']));
    }
    saveData();
    const {emit} = require("../websocket");
    emit.emitUsers();
  },

  deleteUser: user => {
    console.log('deleting user', _.pick(user, ['id', 'name']));
    delete globalData.users[user.id];
    saveData();
    const {emit} = require("../websocket");
    emit.emitUsers();
  },

  renameUser: (user, username) => {
    console.log("Renaming user", _.pick(user, ['id', 'name']), "to", username);
    user.name = username;
    saveData();
    const {emit} = require("../websocket");
    emit.emitUser(user);
    emit.emitUsers();
  },

  changePassword: async (user, password) => {
    console.log("Updating password for user", _.pick(user, ['id', 'name']));
    user.passwordHash = await bcrypt.hash(password, 10);
    saveData();
    const {emit} = require("../websocket");
    emit.emitUser(user);
  },

  updateUserSettings: (user, settings) => {
    console.log("Updating settings for", _.pick(user, ['id', 'name']), "to", settings);
    user.settings = settings;
    saveData();
    const {emit} = require("../websocket");
    emit.emitUser(user);
  },

  changeUserReadyToPlay: (user, readyToPlay) => {
    const {emit} = require("../websocket");
    console.log("User", _.pick(user, ['id', 'name']), "is", readyToPlay ? "" : "not", "ready to play", readyToPlay);
    user.readyToPlay = readyToPlay;
    let game, otherUser;
    if (readyToPlay) {
      // Find challenged user
      if (readyToPlay !== true) {
        const challengedUser = globalData.users[readyToPlay];
        if (!challengedUser) {
          console.log('user challenged non-existing user');
          user.readyToPlay = false;
          return;
        } else if (!challengedUser.online && !challengedUser.readyToPlay) {
          console.log('challenged user is not online or not ready to play');
          saveData();
          emit.emitUser(user);
          emit.emitUsers();
          return;
        } else if (challengedUser.readyToPlay !== true && challengedUser.readyToPlay !== user.id) {
          console.log('challenged has challenged someone else');
          saveData();
          emit.emitUser(user);
          emit.emitUsers();
          return;
        }
        otherUser = challengedUser;
      }
      // If not a challenge, find users that challenged me
      if (!otherUser) {
        otherUser = Object.values(globalData.users).find(otherUser => {
          return otherUser.id !== user.id && user.id === otherUser.readyToPlay;
        });
      }
      // If no challenges, find any ready user
      if (!otherUser) {
        otherUser = Object.values(globalData.users).find(otherUser => {
          return otherUser.id !== user.id && otherUser.readyToPlay;
        });
      }
      if (otherUser) {
        user.readyToPlay = false;
        otherUser.readyToPlay = false;
        game = model.createGame(user, otherUser);
      }
    }
    saveData();
    if (game) {
      console.log('started game', _.pick(game, ['id', 'userIds', 'tournamentId', 'moveCount']));
      emit.emitGames();
      emit.emitUser(otherUser);
    }
    emit.emitUser(user);
    emit.emitUsers();
  },

  getGamePlayersStartingOrder: ([playerA, playerB]) => {
    const lastMatch = _.orderBy(
      Object.values(globalData.games),
      [game => game.startDatetime.toISOString(), 'id'], ['desc', 'desc'])
      .find(game => game.userIds.includes(playerA.id) && game.userIds.includes(playerB.id));
    if (lastMatch) {
      return [globalData.users[lastMatch.userIds[1]], globalData.users[lastMatch.userIds[0]]];
    }

    return _.shuffle([playerA, playerB]);
  },

  createGame: (user, otherUser, tournamentId = null) => {
    let id = uuid4();
    while (id in globalData.games) {
      id = uuid4();
    }
    const gameGame = Game.create();
    let players = [otherUser, user];
    if (!tournamentId) {
      players = model.getGamePlayersStartingOrder(players);
    }
    const userIds = players.map(player => player.id);
    const game = {
      id,
      userIds,
      nextUserId: gameGame.nextPlayer === Game.PLAYER_A ? userIds[0] : gameGame.nextPlayer === Game.PLAYER_B ? userIds[1] : null,
      finished: false,
      winner: null,
      winnerUserId: null,
      game: gameGame,
      serializedGame: gameGame.serialize(),
      move: gameGame.moveCount,
      chainCount: gameGame.chainCount,
      startDatetime: moment(),
      endDatetime: null,
      tournamentId,
      movesDatetimes: [],
      initialPlayerA: services.getEloPlayerScoreData(players[0], players[1]),
      initialPlayerB: services.getEloPlayerScoreData(players[1], players[0]),
      resultingPlayerAScore: null,
      resultingPlayerBScore: null,
      resultingPlayerAScoreDifference: null,
      resultingPlayerBScoreDifference: null,
    };
    console.log('new game', _.pick(game, ['id', 'userIds', 'tournamentId', 'moveCount']));
    globalData.games[game.id] = game;
    if (!tournamentId) {
      saveData();
    }

    return game;
  },

  submitGameMoves: (user, game, moves) => {
    const {emit} = require("../websocket");
    if (!game.userIds.includes(user.id)) {
      console.warn("User was not a player in the game", {gameId: game.id, userId: user.id, gameUserIds: game.userIds});
      return;
    }
    if (game.finished) {
      console.warn("Game was already finished", game);
      return;
    }
    const playerA = globalData.users[game.userIds[0]];
    const playerB = globalData.users[game.userIds[1]];
    if (moves === 'resign') {
      if (game.move < 5 && !game.tournamentId) {
        console.log("User", _.pick(user, ['id', 'name']), "aborted game", _.pick(game, ['id', 'userIds', 'tournamentId', 'moveCount']));
        delete globalData.games[game.id];
        saveData();
        emit.emitGames();
        return;
      }
      const userPlayer = game.userIds[0] === user.id ? Game.PLAYER_A : Game.PLAYER_B;
      const resultingGame = game.game.resign(userPlayer);
      const now = moment();
      Object.assign(game, {
        game: resultingGame,
        nextUserId: resultingGame.nextPlayer === Game.PLAYER_A ? game.userIds[0] : resultingGame.nextPlayer === Game.PLAYER_B ? game.userIds[1] : null,
        serializedGame: resultingGame.serialize(),
        move: resultingGame.moveCount,
        chainCount: resultingGame.chainCount,
        finished: resultingGame.finished,
        winner: resultingGame.winner,
        winnerUserId: resultingGame.winner ? (resultingGame.winner === Game.PLAYER_A ? game.userIds[0] : game.userIds[1]) : null,
        movesDatetimes: game.movesDatetimes.concat([now]),
        endDatetime: resultingGame.finished ? now : null,
      });
      model.updateGameAndUsersAfterEnd(game, playerA, playerB);
      console.log("User", _.pick(user, ['id', 'name']), "resigned", _.pick(game, ['id', 'userIds', 'tournamentId', 'moveCount']));
      return;
    }
    const userPlayer = game.userIds[0] === user.id ? Game.PLAYER_A : Game.PLAYER_B;
    if (game.game.nextPlayer !== userPlayer) {
      console.warn("User was not the next player", {gameId: game.id, userPlayer, nextPlayer: game.game.nextPlayer});
      return;
    }
    if (!moves.length) {
      console.warn("No moves specified");
      return;
    }
    console.log("Player making moves", _.pick(game, ['id', 'userIds', 'tournamentId', 'moveCount']), moves);
    let resultingGame = game.game;
    for (const move of moves) {
      if (resultingGame !== game.game && resultingGame.nextPlayer !== game.game.nextPlayer) {
        console.warn("Tried to make too many moves");
        return;
      }
      try {
        resultingGame = resultingGame.makeMove(move)
      } catch (e) {
        console.error(`Error while making move: ${e}`);
        return;
      }
      console.log(" * Made a move", {
        fromChainCount: game.game.chainCount,
        toChainCount: resultingGame.chainCount,
        fromNextPlayer: game.game.nextPlayer,
        toNextPlayer: resultingGame.nextPlayer
      });
    }
    if (!resultingGame.winner && resultingGame.nextPlayer === game.game.nextPlayer) {
      console.warn("Not enough moves made by player");
      return;
    }

    const now = moment();
    for (const move of moves) {
      game.movesDatetimes.push(now);
    }

    Object.assign(game, {
      game: resultingGame,
      nextUserId: resultingGame.nextPlayer === Game.PLAYER_A ? game.userIds[0] : resultingGame.nextPlayer === Game.PLAYER_B ? game.userIds[1] : null,
      serializedGame: resultingGame.serialize(),
      move: resultingGame.moveCount,
      chainCount: resultingGame.chainCount,
      finished: resultingGame.finished,
      winner: resultingGame.winner,
      winnerUserId: resultingGame.winner ? (resultingGame.winner === Game.PLAYER_A ? game.userIds[0] : game.userIds[1]) : null,
      endDatetime: resultingGame.finished ? now : null,
    });
    if (game.finished) {
      model.updateGameAndUsersAfterEnd(game, playerA, playerB);
      if (game.tournamentId) {
        emit.emitTournaments();
      }
    } else {
      saveData();
      emit.emitGames();
    }
    console.log("Made a move on game", _.pick(game, ['id', 'userIds', 'tournamentId', 'moveCount']));
  },

  updateGameAndUsersAfterEnd: (game, playerA, playerB) => {
    const playerAWon = game.winnerUserId === playerA.id;
    const [newPlayerAScore, newPlayerBScore, newGame] = services.scoreGame(
      playerAWon, game.initialPlayerA, game.initialPlayerB, playerA, playerB);
    Object.assign(game, newGame);
    if (game.tournamentId) {
      model.updateTournamentAfterGameEnd(game);
    } else {
      Object.assign(playerA, newPlayerAScore);
      Object.assign(playerB, newPlayerBScore);
    }
    saveData();
    const {emit} = require("../websocket");
    emit.emitUser(playerA);
    emit.emitUser(playerB);
    emit.emitUsers();
    emit.emitGames();
  },

  isGameTooShortToResign: game => {
    return game.move < 5;
  },

  createTournament: (creator, {name, gameCount}) => {
    if ((typeof gameCount !== typeof 0) || isNaN(gameCount)) {
      console.log('Invalid number of game counts', gameCount);
      return null;
    }
    if (gameCount !== Math.floor(gameCount)) {
      console.log('Game counts was not a valid number', gameCount);
      return null;
    }
    if (gameCount < 1 || gameCount > 5) {
      console.log('Game counts was not in valid range', gameCount);
      return null;
    }
    let id = uuid4();
    while (id in globalData.tournaments) {
      id = uuid4();
    }
    const tournament = {
      id,
      name,
      creatorUserId: creator.id,
      gameIds: [],
      userIds: [creator.id],
      winnerUserId: null,
      startDatetime: null,
      endDatetime: null,
      createdDatetime: moment(),
      gameCount,
      round: 0,
      rounds: 0,
      schedule: null,
      userStats: null,
      started: false,
      finished: false,
    };
    console.log('new tournament', _.pick(tournament, ['id', 'name', 'userIds', 'gameCount', 'start', 'finished', 'round']));
    globalData.tournaments[tournament.id] = tournament;
    saveData();

    const {emit} = require("../websocket");
    emit.emitTournaments();

    return tournament;
  },

  joinTournament: (user, tournamentId) => {
    const tournament = globalData.tournaments[tournamentId];
    if (!tournament) {
      console.log('tournament not found', tournamentId);
      return;
    }
    if (tournament.userIds.includes(user.id)) {
      console.log('user', user.id, 'already part of tournament', tournament.id);
      return;
    }
    if (tournament.started) {
      console.log('tournament', tournament.id, 'has already started');
      return;
    }
    tournament.userIds = tournament.userIds.concat([user.id]);
    saveData();
    console.log('user', user.id, 'joined tournament', _.pick(tournament, ['id', 'name', 'userIds', 'gameCount', 'start', 'finished', 'round']));

    const {emit} = require("../websocket");
    emit.emitTournaments();
  },

  leaveTournament: (user, tournamentId) => {
    const tournament = globalData.tournaments[tournamentId];
    if (!tournament) {
      console.log('tournament not found', tournamentId);
      return;
    }
    if (!tournament.userIds.includes(user.id)) {
      console.log('user', user.id, 'is not part of tournament', tournament.id);
      return;
    }
    if (tournament.started) {
      console.log('tournament', tournament.id, 'has already started');
      return;
    }
    tournament.userIds = tournament.userIds.filter(userId => userId !== user.id);
    saveData();
    console.log('user', user.id, 'left tournament', _.pick(tournament, ['id', 'name', 'gameCount', 'start', 'finished', 'round']));

    const {emit} = require("../websocket");
    emit.emitTournaments();
  },

  startTournament: (user, tournamentId) => {
    const tournament = globalData.tournaments[tournamentId];
    if (!tournament) {
      console.log('tournament not found', tournamentId);
      return;
    }
    if (tournament.creatorUserId !== user.id) {
      console.log('user', user.id, 'is not the creator of tournament', tournament.id, 'it is', tournament.creatorUserId);
      return;
    }
    if (tournament.started) {
      console.log('tournament', tournament.id, 'has already started');
      return;
    }
    if (tournament.userIds.length < 2) {
      console.log('tournament', tournament.id, 'needs at least 2 participants, it has', tournament.userIds.length);
      return;
    }

    const players = tournament.userIds.map(userId => globalData.users[userId]);
    let schedule = services.tournament.createTournamentSchedule(players, tournament.gameCount);
    schedule = schedule.map((pairings, index) => ({
      round: index + 1,
      type: 'normal',
      pairings: pairings.map(pairing => ({
        userIds: pairing,
        sittingOut: !pairing[0] || !pairing[1],
        gameId: null,
      })),
    }));
    console.log('created schedule for tournament', tournament.id, JSON.stringify(tournament.schedule, undefined, 2));
    Object.assign(tournament, {
      started: true,
      startDatetime: moment(),
      round: 0,
      rounds: schedule.length,
      schedule,
      userStats: _.fromPairs(players.map(player => [player.id, {
        userId: player.id,
        initialScore: services.elo.getEloPlayerTournamentScoreData(player, players, tournament.gameCount),
        rank: 1,
        points: 0,
        ratedPoints: 0,
        gameIds: [],
        gamesLeft: tournament.gameCount,
        gamesSatOut: 0,
        currentGameId: null,
        waitingForNextRound: true,
        scoreDifference: null,
      }])),
    });
    model.startTournamentRound(tournament);
    console.log('tournament', tournament.id, 'just started', _.pick(tournament, ['id', 'name', 'gameCount', 'start', 'finished', 'round']));
    saveData();

    const {emit} = require("../websocket");
    emit.emitGames();
    emit.emitTournaments();
  },

  startTournamentRound: tournament => {
    const nextRoundNumber = tournament.round + 1;
    const round = tournament.schedule[nextRoundNumber - 1];
    console.log('tournament', tournament.id, round.type, 'round', round.round, 'is starting');
    tournament.round = round.round;
    for (const pairing of round.pairings) {
      const {userIds: [playerAId, playerBId], sittingOut} = pairing;
      const playerAStats = tournament.userStats[playerAId];
      const playerBStats = tournament.userStats[playerBId];
      if (sittingOut) {
        if (playerAId) {
          Object.assign(playerAStats, {
            gameIds: playerAStats.gameIds.concat([null]),
            currentGameId: null,
            waitingForNextRound: true,
            gamesLeft: playerAStats.gamesLeft - 1,
            gamesSatOut: playerAStats.gamesSatOut + 1,
          });
        } else if (playerBId) {
          Object.assign(playerBStats, {
            gameIds: playerBStats.gameIds.concat([null]),
            currentGameId: null,
            waitingForNextRound: true,
            gamesLeft: playerBStats.gamesLeft - 1,
            gamesSatOut: playerBStats.gamesSatOut + 1,
          });
        }
        continue;
      }
      const playerA = globalData.users[playerAId];
      const playerB = globalData.users[playerBId];
      const game = model.createGame(playerA, playerB, tournament.id);
      tournament.gameIds.push(game.id);
      pairing.gameId = game.id;
      Object.assign(playerAStats, {
        gameIds: playerAStats.gameIds.concat([game.id]),
        currentGameId: game.id,
        waitingForNextRound: false,
      });
      Object.assign(playerBStats, {
        gameIds: playerBStats.gameIds.concat([game.id]),
        currentGameId: game.id,
        waitingForNextRound: false,
      });
    }
    console.log('tournament', tournament.id, round.type, 'round', tournament.round, 'just started');
  },

  updateTournamentAfterGameEnd: game => {
    const tournament = globalData.tournaments[game.tournamentId];
    const round = tournament.schedule.find(round => round.pairings.find(pairing => pairing.gameId === game.id));
    const [playerAId, playerBId] = game.userIds;
    const playerAStats = tournament.userStats[playerAId];
    const playerBStats = tournament.userStats[playerBId];
    Object.assign(playerAStats, {
      currentGameId: null,
      waitingForNextRound: true,
      gamesLeft: playerAStats.gamesLeft - 1,
      points: playerAStats.points + (game.winnerUserId === playerAId ? 1 : 0),
    });
    if (round.type === 'normal') {
      playerAStats.ratedPoints = playerAStats.points;
    }
    Object.assign(playerBStats, {
      currentGameId: null,
      waitingForNextRound: true,
      gamesLeft: playerBStats.gamesLeft - 1,
      points: playerBStats.points + (game.winnerUserId === playerBId ? 1 : 0),
    });
    if (round.type === 'normal') {
      playerBStats.ratedPoints = playerBStats.points;
    }
    model.rankPlayersInTournament(tournament);
    if (!Object.values(tournament.userStats).find(stats => !stats.waitingForNextRound)) {
      model.updateTournamentAfterRoundEnd(tournament);
    } else {
      saveData();
      const {emit} = require("../websocket");
      emit.emitTournaments();
    }
  },

  rankPlayersInTournament: tournament => {
    const orderedStats = _.orderBy(tournament.userStats,
      ['points', 'initialScore.score', 'id'], ['desc', 'desc', 'desc']);
    orderedStats.forEach((stats, index) => {
      const previousStats = orderedStats[index - 1];
      if (previousStats && stats.points === previousStats.points) {
        stats.rank = previousStats.rank;
      } else {
        stats.rank = index + 1;
      }
    });
    console.log('ranked tournament players', orderedStats.map(userStats => _.pick(userStats, ['points', 'initialScore.score', 'id', 'rank'])));
  },

  updateTournamentAfterRoundEnd: tournament => {
    console.log('tournament', tournament.id, 'round', tournament.round, 'ended');
    if (tournament.round < tournament.rounds) {
      model.startTournamentRound(tournament);
      saveData();
      const {emit} = require("../websocket");
      emit.emitGames();
      emit.emitTournaments();
      return;
    }

    const winners = Object.values(tournament.userStats).filter(stats => stats.rank === 1);
    if (winners.length === 1) {
      model.updateTournamentAfterLastRoundEnd(tournament);
      return;
    }

    model.addAndStartTournamentPlayoffRound(tournament);
    saveData();
    const {emit} = require("../websocket");
    emit.emitGames();
    emit.emitTournaments();
  },

  addAndStartTournamentPlayoffRound: tournament => {
    console.log('adding playoff round to tournament', _.pick(tournament, ['id', 'name', 'gameCount', 'start', 'finished', 'round']));
    const nextRoundNumber = tournament.round + 1;
    let winners = Object.values(tournament.userStats)
      .filter(stats => stats.rank === 1);
    winners = _.orderBy(winners, ['gamesSatOut'], ['desc']);
    winners = winners.map(stats => stats.userId);
    const playerAs = winners.slice(0, Math.ceil(winners.length / 2));
    const playerBs = winners.slice(Math.ceil(winners.length / 2));
    let sittingOutUserId = null;
    if (playerBs.length < playerAs.length) {
      playerBs.push(null);
      sittingOutUserId = playerAs[playerAs.length - 1];
    }
    const pairings = _.zip(playerAs, playerBs);
    const round = {
      round: nextRoundNumber,
      type: 'playoff',
      pairings: pairings.map(pairing => ({
        userIds: pairing,
        sittingOut: !pairing[0] || !pairing[1],
        gameId: null,
      })),
    };
    tournament.schedule.push(round);
    tournament.rounds += 1;
    for (const stats of Object.values(tournament.userStats)) {
      stats.gamesLeft += 1;
    }
    if (sittingOutUserId) {
      tournament.userStats[sittingOutUserId].points += 1;
    }
    console.log('added playoff round to tournament', _.pick(tournament, ['id', 'name', 'gameCount', 'start', 'finished', 'round']));
    model.startTournamentRound(tournament);
  },

  updateTournamentAfterLastRoundEnd: tournament => {
    console.log('tournament', tournament.id, 'last round ended', _.pick(tournament, ['id', 'name', 'gameCount', 'start', 'finished', 'round']));
    const winnerUserId = Object.values(tournament.userStats).find(stats => stats.rank === 1).userId;
    Object.assign(tournament, {
      finished: true,
      endDatetime: moment(),
      winnerUserId,
    });
    for (const stats of Object.values(tournament.userStats)) {
      stats.waitingForNextRound = false;
    }
    model.scoreTournamentPlayers(tournament);
    console.log('tournament', tournament.id, 'finished', _.pick(tournament, ['id', 'name', 'gameCount', 'start', 'finished', 'round']));
    saveData();
    const {emit} = require("../websocket");
    emit.emitTournaments();
  },

  scoreTournamentPlayers: tournament => {
    for (const userId of tournament.userIds) {
      const player = globalData.users[userId];
      const stats = tournament.userStats[userId];
      const [newPlayer, newStats] = services.elo.scoreTournamentPlayer(player, tournament);
      Object.assign(player, newPlayer);
      Object.assign(stats, newStats);
    }
  },

  abortTournament: (user, tournamentId) => {
    const tournament = globalData.tournaments[tournamentId];
    if (!tournament) {
      console.log('tournament not found', tournamentId);
      return;
    }
    if (tournament.creatorUserId !== user.id) {
      console.log('user', user.id, 'is not the creator of tournament', tournament.id, 'it is', tournament.creatorUserId);
      return;
    }
    if (tournament.started) {
      console.log('tournament', tournament.id, 'has already started');
      return;
    }
    delete globalData.tournaments[tournament.id];
    saveData();
    console.log('tournament', tournament.id, 'was aborted');

    const {emit} = require("../websocket");
    emit.emitTournaments();
  },

  cleanupUsersAndGames: () => {
    const now = moment();
    const gamesToRemove = Object.values(globalData.games).filter(game => {
      if (!model.isGameTooShortToResign(game)) {
        return false;
      }
      if (game.tournamentId) {
        return false;
      }
      const lastDatetime = game.movesDatetimes[game.movesDatetimes.length - 1] || game.startDatetime;
      const abortDatetime = lastDatetime.add(1, 'day');
      if (abortDatetime.isAfter(now)) {
        return false;
      }

      return true;
    });
    if (gamesToRemove.length) {
      for (const game of gamesToRemove) {
        delete globalData.games[game.id];
      }
      console.log('removed', gamesToRemove.length, 'not-started games');
    }
    const userIdsWithGamesOrTournaments = new Set([
      ..._.flatten(Object.values(globalData.games).map(game => game.userIds)),
      ..._.flatten(Object.values(globalData.tournaments).map(tournament => tournament.creatorUserId)),
    ]);
    const usersToRemove = Object.values(globalData.users)
      .filter(user => {
        if (user.online) {
          return false;
        }
        if (user.passwordHash) {
          return false;
        }
        if (userIdsWithGamesOrTournaments.has(user.id)) {
          return false;
        }

        return true;
      });
    if (usersToRemove.length) {
      for (const user of usersToRemove) {
        delete globalData.users[user.id];
      }
      console.log('removed', usersToRemove.length, 'users with no games and no password');
    }

    const {emit} = require("../websocket");
    if (gamesToRemove.length) {
      emit.emitGames();
    }
    if (usersToRemove.length) {
      emit.emitUsers();
    }
  },

  resignOldGames: () => {
    const now = moment();
    const gamesToResign = Object.values(globalData.games).filter(game => {
      if (game.finished) {
        return false;
      }
      if (model.isGameTooShortToResign(game)) {
        return false;
      }
      if (game.tournamentId) {
        return false;
      }
      const lastDatetime = game.movesDatetimes[game.movesDatetimes.length - 1] || game.startDatetime;
      const resignDatetime = lastDatetime.add(1, 'day');
      if (resignDatetime.isAfter(now)) {
        return false;
      }

      return true;
    });
    if (gamesToResign.length) {
      for (const game of gamesToResign) {
        const user = globalData.users[game.nextUserId];
        model.submitGameMoves(user, game, 'resign');
      }
      console.log("Resigned", gamesToResign.length, "games after inactivity");
    }
  },
};

module.exports = model;
