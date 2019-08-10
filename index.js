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
const {Game} = require('./game/game');
const fs = require('fs');

const minAppVersion = 1;

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});

const saveData = () => {
  if (fs.existsSync('data.json')) {
    fs.copyFileSync('data.json', 'data.json.backup');
  }
  const writeUsers = {};
  for (const user of Object.values(users)) {
    writeUsers[user.id] = {...user, sockets: []};
  }
  const writeGames = {};
  for (const game of Object.values(games)) {
    writeGames[game.id] = {...game, game: null};
  }
  fs.writeFileSync('data.json', JSON.stringify({users: writeUsers, games: writeGames}, undefined, 2));
  if (!fs.existsSync('data.json')) {
    console.error("Just wrote data but could not find the file");
    throw new Error("Just wrote data but could not find the file");
  }
};

const loadData = () => {
  if (!fs.existsSync('data.json')) {
    return {users: {}, games: {}};
  }
  const {users: loadUsers, games: loadGames} = JSON.parse(fs.readFileSync('data.json'));
  for (const game of Object.values(loadGames)) {
    game.game = Game.deserialize(game.serializedGame);
  }
  return {users: loadUsers, games: loadGames};
};

const {users, games} = loadData();

const askUserToReload = socket => {
  socket.emit('reload');
};

const createUser = (socket) => {
    let id = uuid4();
    while (id in users) {
      id = uuid4();
    }
    const user = {
      id,
      name: `Guest ${id.slice(0, 4)}`,
      password: uuid4().slice(0, 4),
      online: true,
      readyToPlay: false,
      sockets: [socket],
    };
    users[user.id] = user;
    saveData();

    return user;
};

const loadUser = (id, socket) => {
  const user = users[id];
  user.online = true;
  user.sockets = user.sockets.includes(socket) ? user.sockets : user.sockets.concat([socket]);
  saveData();
  return user;
};

const loadOrCreateUser = (id, password, socket) => {
  let user, created;
  if (id && id in users && users[id].password === password) {
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

const changeUserReadyToPlay = (user, readyToPlay) => {
  console.log("User", user.name, "is", readyToPlay ? "" : "not", "ready to play");
  user.readyToPlay = readyToPlay;
  let game, otherUser;
  if (readyToPlay) {
    otherUser = Object.values(users).find(otherUser => otherUser.id !== user.id && otherUser.readyToPlay);
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
  while (id in games) {
    id = uuid4();
  }
  const gameGame = Game.create();
  const game = {
    id,
    userIds: [otherUser.id, user.id],
    finished: false,
    winner: null,
    winnerUserId: null,
    game: gameGame,
    serializedGame: gameGame.serialize(),
    move: gameGame.moveCount,
    chainCount: gameGame.chainCount,
  };
  games[game.id] = game;
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
    Object.assign(game, {
      game: resultingGame,
      serializedGame: resultingGame.serialize(),
      move: resultingGame.moveCount,
      chainCount: resultingGame.chainCount,
      finished: resultingGame.finished,
      winner: resultingGame.winner,
      winnerUserId: resultingGame.winner ? (resultingGame.winner === Game.PLAYER_A ? game.userIds[0] : game.userIds[1]) : null,
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

  Object.assign(game, {
    game: resultingGame,
    serializedGame: resultingGame.serialize(),
    move: resultingGame.moveCount,
    chainCount: resultingGame.chainCount,
    finished: resultingGame.finished,
    winner: resultingGame.winner,
    winnerUserId: resultingGame.winner ? (resultingGame.winner === Game.PLAYER_A ? game.userIds[0] : game.userIds[1]) : null,
  });
  saveData();
  console.log("Made a move on game", game.id, game);
  emitGames();
};

const emitUser = ({id, name, password, online, readyToPlay, sockets}) => {
  sockets.map(socket => socket.emit("user", {id, name, password, online, readyToPlay}));
};

const emitUsers = (socket = io) => {
  socket.emit("users", Object.values(users).map(({id, name, online, readyToPlay}) => ({id, name, online, readyToPlay})));
};

const emitGames = (socket = io) => {
  socket.emit("games", Object.values(games).map(({id, userIds, finished, serializedGame: game, move, chainCount}) => ({id, userIds, finished, game, move, chainCount})));
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
    const game = games[id];
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
