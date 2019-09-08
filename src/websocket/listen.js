const emit = require('./emit');
const {io} = require('./io');

let {model, globalData} = {};

const minAppVersion = 2;

class Connection {
  static connect = socket => {
    if (!model) {
      ({model, persistence: {globalData}} = require('../data'));
    }
    return new this(socket);
  };

  constructor(socket) {
    console.log('a user connected');
    this.socket = socket;
    this.user = null;
    this.setupCommands();
  }

  setupCommands() {
    for (const [command, callback] of Object.entries(this.socketMap)) {
      this.socket.on(command, callback);
    }
    this.socketMap = {};
  }

  socketMap = {};

  on = (command, callback) => {
    this.socketMap[command] = callback;
    if (this.socket) {
      this.setupCommands();
    }
    return callback;
  };

  createUser = this.on('create-user', ({appVersion, id, token} = {}) => {
    if (!appVersion) {
      console.log('user has app with no version');
      // Try anyway to make it reload
      emit.askUserToReload(this.socket);
      this.user = null;
      return;
    }
    if (appVersion < minAppVersion) {
      console.log('user has old app version', {appVersion, minAppVersion});
      emit.askUserToReload(this.socket);
      this.user = null;
      return;
    }
    if (this.user) {
      emit.emitUser(this.user);
      emit.emitUsers(this.socket);
      emit.emitGames(this.socket);
      return;
    }

    [this.user] = model.loadOrCreateUser(id, token, this.socket);
  });

  changeUsername = this.on('change-username', username => {
    if (!this.user) {
      return;
    }

    model.renameUser(this.user, username);
  });

  changePassword = this.on('change-password', async password => {
    if (!this.user) {
      return;
    }

    await model.changePassword(this.user, password);
  });

  updateSettings = this.on('update-settings', settings => {
    if (!this.user) {
      return;
    }

    model.updateUserSettings(this.user, settings);
  });

  changeReadyToPlay = this.on('change-ready-to-play', readyToPlay => {
    if (!this.user) {
      return;
    }

    model.changeUserReadyToPlay(this.user, readyToPlay);
  });

  submitGameMoves = this.on('submit-game-moves', ({id, moves}) => {
    if (!this.user) {
      return;
    }
    const game = globalData.games[id];
    if (!game) {
      console.warn("Game not recognised", id);
      return;
    }

    model.submitGameMoves(this.user, game, moves);
  });

  disconnect = this.on('disconnect', () => {
    if (this.user) {
      model.disconnectUser(this.user, this.socket);
      this.user = null;
    }
  });
}

io.on('connection', Connection.connect);
