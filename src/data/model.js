const uuid4 = require('uuid4');
const {Game} = require('../game/game');
const {saveData, globalData} = require("./persistence");
const _ = require('lodash');
const moment = require('moment');
const bcrypt = require('bcrypt');

const model = {
  createUser: (socket) => {
    let id = uuid4();
    while (id in globalData.users) {
      id = uuid4();
    }
    const user = {
      id,
      name: `Guest ${id.slice(0, 4)}`,
      token: uuid4(),
      passwordHash: null,
      online: true,
      readyToPlay: false,
      settings: {
        autoSubmitMoves: false,
        enableNotifications: false,
        theme: {scheme: '', rotated: false, rounded: false, numbers: ''},
      },
      sockets: [socket],
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

  loadOrCreateUser: (id, token, socket) => {
    let user, created;
    if (id && id in globalData.users && globalData.users[id].token === token) {
      user = model.loadUser(id, socket);
      console.log('existing user', user);
      created = false;
    } else {
      user = model.createUser(socket);
      console.log('Created user', user);
      created = true;
    }
    saveData();
    const {emit} = require("../websocket");
    emit.emitUser(user);
    emit.emitUsers();
    emit.emitGames(socket);

    return [user, created];
  },

  disconnectUser: (user, socket) => {
    console.log("client disconnected", user.name);
    user.sockets = user.sockets.filter(otherSocket => otherSocket !== socket);
    user.online = user.sockets.length > 0;
    if (!user.online) {
      user.readyToPlay = false;
      console.log("user disconnected", user.name);
    }
    saveData();
    const {emit} = require("../websocket");
    emit.emitUsers();
  },

  renameUser: (user, username) => {
    console.log("Renaming user", user.name, "to", username);
    user.name = username;
    saveData();
    const {emit} = require("../websocket");
    emit.emitUser(user);
    emit.emitUsers();
  },

  changePassword: async (user, password) => {
    console.log("Updating password for user", user.name);
    user.passwordHash = await bcrypt.hash(password, 10);
    saveData();
  },

  updateUserSettings: (user, settings) => {
    console.log("Updating settings for", user.name, "to", settings);
    user.settings = settings;
    saveData();
    const {emit} = require("../websocket");
    emit.emitUser(user);
  },

  changeUserReadyToPlay: (user, readyToPlay) => {
    const {emit} = require("../websocket");
    console.log("User", user.name, "is", readyToPlay ? "" : "not", "ready to play", readyToPlay);
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
      console.log('started game', game);
      emit.emitGames();
      emit.emitUser(otherUser);
    }
    emit.emitUser(user);
    emit.emitUsers();
  },

  createGame: (user, otherUser) => {
    let id = uuid4();
    while (id in globalData.games) {
      id = uuid4();
    }
    const gameGame = Game.create();
    const userIds = _.shuffle([otherUser.id, user.id]);
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
      movesDatetimes: [],
    };
    console.log('new game', game);
    globalData.games[game.id] = game;
    saveData();

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
    if (moves === 'resign') {
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
      saveData();
      console.log("User resigned", {gameId: game.id, userId: user.id});
      emit.emitGames();
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
    console.log("Player making moves", {gameId: game.id, moves});
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
    saveData();
    console.log("Made a move on game", game.id, game);
    emit.emitGames();
  },
};

module.exports = model;