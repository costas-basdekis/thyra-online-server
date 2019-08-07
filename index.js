const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const uuid4 = require('uuid4');
const {Game} = require('./game/game');

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});

const users = {};
const games = {};

const emitUser = ({id, name, password, online, readyToPlay, sockets}) => {
  sockets.map(socket => socket.emit("user", {id, name, password, online, readyToPlay}));
};

const emitUsers = (socket = io) => {
  socket.emit("users", Object.values(users).filter(user => user.online).map(({id, name, readyToPlay}) => ({id, name, readyToPlay})));
};

const emitGames = (socket = io) => {
  socket.emit("games", Object.values(games).map(({id, userIds, finished, serializedGame: game, move, chainCount}) => ({id, userIds, finished, game, move, chainCount})));
};

io.on('connection', function(socket){
  console.log('a user connected');
  let user = null;
  socket.on('create-user', ({id, password} = {}) => {
    if (user) {
      emitUser(user);
      emitUsers(socket);
      emitGames(socket);
      return;
    }

    if (id && id in users && users[id].password === password) {
      user = users[id];
      user.online = true;
      user.sockets = user.sockets.includes(socket) ? user.sockets : user.sockets.concat([socket]);
      console.log('existing user', user);
      emitUser(user);
      emitUsers();
      emitGames(socket);
      return;
    }

    id = uuid4();
    while (id in users) {
      id = uuid4();
    }
    user = {
      id,
      name: `Guest ${id.slice(0, 4)}`,
      password: uuid4().slice(0, 4),
      online: true,
      readyToPlay: false,
      sockets: [socket],
    };
    users[user.id] = user;
    console.log('Created user', user);

    emitUser(user);
    emitUsers();
    emitGames(socket);
  });
  socket.on('change-username', username => {
    if (!user) {
      return;
    }

    console.log("Renaming user", user.name, "to", username);
    user.name = username;
    emitUser(user);
    emitUsers();
  });
  socket.on('change-ready-to-play', readyToPlay => {
    if (!user) {
      return;
    }

    console.log("User", user.name, "is", readyToPlay ? "" : "not", "ready to play");
    user.readyToPlay = readyToPlay;
    if (readyToPlay) {
      const otherUser = Object.values(users).find(otherUser => otherUser.id !== user.id && otherUser.readyToPlay);
      if (otherUser) {
        user.readyToPlay = false;
        otherUser.readyToPlay = false;
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
        console.log('started game', game);
        emitGames();
        emitUser(otherUser);
      }
    }
    emitUser(user);
    emitUsers();
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
    console.log("Made a move on game", game.id, game);
    emitGames();
  });
  socket.on('disconnect', () => {
    if (user) {
      console.log("user disconnected", user.name);
      user.sockets = user.sockets.filter(otherSocket => otherSocket !== socket);
      user.online = user.sockets.length > 0;
      if (!user.online) {
        user.readyToPlay = false;
      }
      emitUsers();
    }
  });
});

http.listen(4000, function(){
  console.log('listening on *:4000');
});
