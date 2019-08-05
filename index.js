const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const uuid4 = require('uuid4');

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});

const users = {};

const emitUsers = () => {
  io.emit("users", Object.values(users).filter(user => user.online).map(({id, name}) => ({id, name})));
};

io.on('connection', function(socket){
  console.log('a user connected');
  let user = null;
  socket.on('create-user', () => {
    if (user) {
      socket.emit("user", user);
      return;
    }

    let id = uuid4();
    while (id in users) {
      id = uuid4();
    }
    user = {
      id,
      name: `Guest ${id.slice(0, 4)}`,
      password: uuid4().slice(0, 4),
      online: true,
    };
    users[user.id] = user;
    console.log('Created user', user);

    socket.emit("user", user);
    emitUsers();
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
  socket.on('disconnect', () => {
    if (user) {
      user.online = false;
      emitUsers();
    }
  });
});

http.listen(4000, function(){
  console.log('listening on *:4000');
});
