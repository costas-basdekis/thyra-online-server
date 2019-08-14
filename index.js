const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  //origins: '*:*',
  handlePreflightRequest: (req, res) => {
    const headers = {
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Origin": req.headers.origin, //or the specific origin you want to give access to,
        "Access-Control-Allow-Credentials": true
    };
    res.writeHead(200, headers);
    res.end();
  },
});
const uuid4 = require('uuid4');
const {Game} = require('./src/game/game');
const {getInitialData, migrate} = require('./src/migrations');
const fs = require('fs');
const _ = require('lodash');
const moment = require('moment');

const minAppVersion = 1;

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});

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
    saveData(dataFromLoad);
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

const askUserToReload = socket => {
  socket.emit('reload');
};

const createUser = (socket) => {
    let id = uuid4();
    while (id in globalData.users) {
      id = uuid4();
    }
    const user = {
      id,
      name: `Guest ${id.slice(0, 4)}`,
      password: uuid4().slice(0, 4),
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
};

const loadUser = (id, socket) => {
  const user = globalData.users[id];
  user.online = true;
  user.sockets = user.sockets.includes(socket) ? user.sockets : user.sockets.concat([socket]);
  saveData();
  return user;
};

const loadOrCreateUser = (id, password, socket) => {
  let user, created;
  if (id && id in globalData.users && globalData.users[id].password === password) {
    user = loadUser(id, socket);
    console.log('existing user', user);
    created = false;
  } else {
    user = createUser(socket);
    console.log('Created user', user);
    created = true;
  }
  saveData();
  emitUser(user);
  emitUsers();
  emitGames(socket);

  return [user, created];
};

const disconnectUser = (user, socket) => {
  console.log("client disconnected", user.name);
  user.sockets = user.sockets.filter(otherSocket => otherSocket !== socket);
  user.online = user.sockets.length > 0;
  if (!user.online) {
    user.readyToPlay = false;
    console.log("user disconnected", user.name);
  }
  saveData();
  emitUsers();
};

const renameUser = (user, username) => {
  console.log("Renaming user", user.name, "to", username);
  user.name = username;
  saveData();
  emitUser(user);
  emitUsers();
};

const updateUserSettings = (user, settings) => {
  console.log("Updating settings for", user.name, "to", settings);
  user.settings = settings;
  saveData();
  emitUser(user);
};

const changeUserReadyToPlay = (user, readyToPlay) => {
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
      } else if(!challengedUser.online && !challengedUser.readyToPlay) {
        console.log('challenged user is not online or not ready to play');
        saveData();
        emitUser(user);
        emitUsers();
        return;
      } else if (challengedUser.readyToPlay !== true && challengedUser.readyToPlay !== user.id) {
        console.log('challenged has challenged someone else');
        saveData();
        emitUser(user);
        emitUsers();
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
      game = createGame(user, otherUser);
    }
  }
  saveData();
  if (game) {
    console.log('started game', game);
    emitGames();
    emitUser(otherUser);
  }
  emitUser(user);
  emitUsers();
};

const createGame = (user, otherUser) => {
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
};

const submitGameMoves = (user, game, moves) => {
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
    emitGames();
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
    console.log(" * Made a move", {fromChainCount: game.game.chainCount, toChainCount: resultingGame.chainCount, fromNextPlayer: game.game.nextPlayer, toNextPlayer: resultingGame.nextPlayer});
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
  emitGames();
};

const emitUser = ({id, name, password, online, readyToPlay, settings, sockets}) => {
  sockets.map(socket => socket.emit("user", {id, name, password, online, readyToPlay, settings}));
};

const emitUsers = (socket = io) => {
  socket.emit("users", Object.values(globalData.users).map(({id, name, online, readyToPlay, settings}) => ({id, name, online, readyToPlay, settings})));
};

const emitGames = (socket = io) => {
  socket.emit("games", Object.values(globalData.games).map(({
    id, userIds, finished, winner, winnerUserId, nextUserId, serializedGame: game, move, chainCount,
    startDatetime, endDatetime, movesDatetimes,
  }) => ({
    id, userIds, finished, winner, winnerUserId, nextUserId, game, move, chainCount,
    startDatetime: startDatetime.toISOString(), endDatetime: endDatetime ? endDatetime.toISOString() : null,
    movesDatetimes: movesDatetimes.map(datetime => datetime.toISOString()),
  })));
};

io.on('connection', function(socket){
  console.log('a user connected');
  let user = null;
  socket.on('create-user', ({appVersion, id, password} = {}) => {
    if (!appVersion) {
      console.log('user has app with no version');
      // Try anyway to make it reload
      askUserToReload(socket);
      user = null;
      return;
    }
    if (appVersion < minAppVersion) {
      console.log('user has old app version', {appVersion, minAppVersion});
      askUserToReload(socket);
      user = null;
      return;
    }
    if (user) {
      emitUser(user);
      emitUsers(socket);
      emitGames(socket);
      return;
    }

    [user] = loadOrCreateUser(id, password, socket);
  });
  socket.on('change-username', username => {
    if (!user) {
      return;
    }

    renameUser(user, username);
  });
  socket.on('update-settings', settings => {
    if (!user) {
      return;
    }

    updateUserSettings(user, settings);
  });
  socket.on('change-ready-to-play', readyToPlay => {
    if (!user) {
      return;
    }

    changeUserReadyToPlay(user, readyToPlay);
  });
  socket.on('submit-game-moves', ({id, moves}) => {
    if (!user) {
      return;
    }
    const game = globalData.games[id];
    if (!game) {
      console.warn("Game not recognised", id);
      return;
    }

    submitGameMoves(user, game, moves);
  });
  socket.on('disconnect', () => {
    if (user) {
      disconnectUser(user, socket);
      user = null;
    }
  });
});

http.listen(4000, function(){
  console.log('listening on *:4000');
});
