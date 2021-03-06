const emit = require('./emit');
const {io} = require('./io');

let {model, globalData} = {};

const minAppVersion = 14;

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

  createUser = this.on('create-user', ({appVersion, id, name, token, settings} = {}) => {
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
    if (!this.user) {
      [this.user] = model.loadOrCreateUser({id, name, token, settings}, this.socket);
    }
    emit.emitUser(this.user);
    emit.emitUsers(this.socket);
    emit.emitGames(this.socket);
    emit.emitTournaments(this.socket);
    emit.emitPuzzles(this.socket);
    emit.emitPersonalPuzzles([this.user.id]);
  });

  logIn = this.on('log-in', async ({name, password, mergeUsers}) => {
    const user = await model.logUserIn(name, password, mergeUsers, this.user, this.socket);
    if (user) {
      if (this.user) {
        model.disconnectOrDeleteUser(this.user, this.socket);
      }
      this.user = user;
      emit.emitUser(this.user);
      emit.emitUsers(this.socket);
      emit.emitPuzzles(this.socket);
      emit.emitPersonalPuzzles([this.user.id]);
    }
  });

  logOut = this.on('log-out', () => {
    if (!this.user) {
      return;
    }

    model.disconnectOrDeleteUser(this.user, this.socket);
    this.user = null;
    [this.user] = model.loadOrCreateUser({}, this.socket);
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

  createTournament = this.on('create-tournament', data => {
    if (!this.user) {
      return;
    }

    model.createTournament(this.user, data);
  });

  joinTournament = this.on('join-tournament', tournamentId => {
    if (!this.user) {
      return;
    }

    model.joinTournament(this.user, tournamentId);
  });

  leaveTournament = this.on('leave-tournament', tournamentId => {
    if (!this.user) {
      return;
    }

    model.leaveTournament(this.user, tournamentId);
  });

  startTournament = this.on('start-tournament', tournamentId => {
    if (!this.user) {
      return;
    }

    model.startTournament(this.user, tournamentId);
  });

  abortTournament = this.on('abort-tournament', tournamentId => {
    if (!this.user) {
      return;
    }

    model.abortTournament(this.user, tournamentId);
  });

  createPuzzle = this.on('create-puzzle', puzzle => {
    if (!this.user) {
      return;
    }

    model.createPuzzle(this.user, puzzle);
  });

  updatePuzzle = this.on('update-puzzle', puzzle => {
    if (!this.user) {
      return;
    }

    model.updatePuzzle(this.user, puzzle);
  });

  submitPuzzleMoves = this.on('submit-puzzle-moves', ({id, path}) => {
    if (!this.user) {
      return;
    }

    const puzzle = globalData.puzzles[id];
    if (!puzzle) {
      console.log("Puzzle not recognised", id);
      return;
    }

    model.submitPuzzleMoves(puzzle, this.user, path);
  });

  disconnect = this.on('disconnect', () => {
    if (this.user) {
      model.disconnectOrDeleteUser(this.user, this.socket);
      this.user = null;
    }
  });
}

const listen = () => {
  io.on('connection', Connection.connect);
};

module.exports = {
  listen,
};
