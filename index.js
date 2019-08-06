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

const emitUsers = (socket = io) => {
  socket.emit("users", Object.values(users).filter(user => user.online).map(({id, name, readyToPlay}) => ({id, name, readyToPlay})));
};

const emitGames = (socket = io) => {
  socket.emit("games", Object.values(games).filter(game => !game.finished));
};

io.on('connection', function(socket){
  console.log('a user connected');
  let user = null;
  socket.on('create-user', ({id, password} = {}) => {
    if (user) {
      socket.emit("user", user);
      emitUsers(socket);
      emitGames(socket);
      return;
    }

    if (id && id in users && users[id].password === password) {
      user = users[id];
      user.online = true;
      console.log('existing user', user);
      socket.emit("user", user);
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
    };
    users[user.id] = user;
    console.log('Created user', user);

    socket.emit("user", user);
    emitUsers();
    emitGames(socket);
  });
  socket.on('change-username', username => {
    if (!user) {
      return;
    }

    console.log("Renaming user", user.name, "to", username);
    user.name = username;
    socket.emit("user", user);
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
        const game = {
          id,
          userIds: [otherUser.id, user.id],
          finished: false,
          game: Game.create().serialize(),
        };
        games[game.id] = game;
        console.log('started game', game);
        emitGames();
      }
    }
    socket.emit("user", user);
    emitUsers();
  });
  socket.on('disconnect', () => {
    if (user) {
      console.log("user disconnected", user.name);
      user.online = false;
      user.readyToPlay = false;
      emitUsers();
    }
  });
});

http.listen(4000, function(){
  console.log('listening on *:4000');
});
