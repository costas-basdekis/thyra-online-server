const emit = require('./emit');
const {io} = require('./io');

const minAppVersion = 2;

io.on('connection', function(socket){
  const {model, persistence: {globalData}} = require('../data');
  console.log('a user connected');
  let user = null;
  socket.on('create-user', ({appVersion, id, token} = {}) => {
    if (!appVersion) {
      console.log('user has app with no version');
      // Try anyway to make it reload
      emit.askUserToReload(socket);
      user = null;
      return;
    }
    if (appVersion < minAppVersion) {
      console.log('user has old app version', {appVersion, minAppVersion});
      emit.askUserToReload(socket);
      user = null;
      return;
    }
    if (user) {
      emit.emitUser(user);
      emit.emitUsers(socket);
      emit.emitGames(socket);
      return;
    }

    [user] = model.loadOrCreateUser(id, token, socket);
  });
  socket.on('change-username', username => {
    if (!user) {
      return;
    }

    model.renameUser(user, username);
  });
  socket.on('change-password', async password => {
    if (!user) {
      return;
    }

    await model.changePassword(user, password);
  });
  socket.on('update-settings', settings => {
    if (!user) {
      return;
    }

    model.updateUserSettings(user, settings);
  });
  socket.on('change-ready-to-play', readyToPlay => {
    if (!user) {
      return;
    }

    model.changeUserReadyToPlay(user, readyToPlay);
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

    model.submitGameMoves(user, game, moves);
  });
  socket.on('disconnect', () => {
    if (user) {
      model.disconnectUser(user, socket);
      user = null;
    }
  });
});
