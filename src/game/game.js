const _ = require('lodash');

class Game {
  static PLAYER_A = 'player-a';
  static PLAYER_B = 'player-b';
  static PLAYERS = [
    this.PLAYER_A,
    this.PLAYER_B,
  ];
  static OTHER_PLAYER = {
    [this.PLAYER_A]: this.PLAYER_B,
    [this.PLAYER_B]: this.PLAYER_A,
  };

  static WORKER_FIRST = 'first-worker';
  static WORKER_SECOND = 'second-worker';

  static MOVE_TYPE_PLACE_FIRST_WORKER = 'place-first-worker';
  static MOVE_TYPE_PLACE_SECOND_WORKER = 'place-second-worker';
  static MOVE_TYPE_SELECT_WORKER_TO_MOVE = 'select-worker-to-move';
  static MOVE_TYPE_MOVE_FIRST_WORKER = 'move-first-worker';
  static MOVE_TYPE_MOVE_SECOND_WORKER = 'move-second-worker';
  static MOVE_TYPE_BUILD_AROUND_WORKER = 'build-around-worker';

  static ROWS = Array.from({length: 5}, (value, index) => index);
  static COLUMNS = Array.from({length: 5}, (value, index) => index);
  static MOVE_NOTATION = this.ROWS.map(y => this.COLUMNS.map(x =>
    `${['A', 'B', 'C', 'D', 'E'][x]}${['1', '2', '3', '4', '5'][y]}`));
  static RESIGNED_NOTATION = {
    [this.PLAYER_A]: 'RA',
    [this.PLAYER_B]: 'RB',
  };
  static REVERSE_NOTATION = {
    ..._.fromPairs(_.flatten(this.ROWS.map(y => this.COLUMNS.map(x =>
      [`${['A', 'B', 'C', 'D', 'E'][x]}${['1', '2', '3', '4', '5'][y]}`, {x, y}])))),
    'RA': [{resign: this.PLAYER_A}],
    'RB': [{resign: this.PLAYER_B}],
  };
  static NOTATION_COMPRESSION = _.fromPairs(Object.keys(this.REVERSE_NOTATION).sort().map((value, index) =>
    [value, String.fromCharCode(index < 26 ? 65 + index : 48 + (index - 26))]));
  static NOTATION_DECOMPRESSION = _.fromPairs(Object.keys(this.REVERSE_NOTATION).sort().map((value, index) =>
    [String.fromCharCode(index < 26 ? 65 + index : 48 + (index - 26)), this.REVERSE_NOTATION[value]]));

  static create() {
    const cells = this.getInitialCells();
    const status = this.getInitialStatus();
    return new this(cells, status, null, null, false);
  }

  static fromMoves(moves) {
    let game = this.create();
    for (const move of moves) {
      game = game.makeMove(move);
    }

    return game;
  }

  static fromNotation(fullNotation) {
    const moves = fullNotation
      .split('')
      .map(part => this.REVERSE_NOTATION[part]);
    if (moves.filter(move => !move).length) {
      return null;
    }

    return this.fromMoves(moves);
  }

  static fromCompressedNotation(compressedFullNotation) {
    const moves = compressedFullNotation
      .split('')
      .map(part => this.NOTATION_DECOMPRESSION[part]);
    if (moves.filter(move => !move).length) {
      return null;
    }

    return this.fromMoves(moves);
  }

  createStep(cells, status, lastMove) {
    return new this.constructor(cells, status, this, lastMove, false);
  }

  createNext(cells, status, lastMove) {
    return new this.constructor(cells, status, this, lastMove, true);
  }

  constructor(cells, status, previous, lastMove, isNextMove) {
    if (!cells || !status) {
      throw new Error("You need to pass cells, status, and previous game");
    }
    this.previous = previous;
    this.history = (this.previous ? this.previous.history : [])
      .filter(game => !game.canUndo)
      .concat([this]);
    this.fullHistory = (this.previous ? this.previous.fullHistory : []).concat(this);
    this.isNextMove = isNextMove;
    this.moveCount = this.previous ? (isNextMove ? this.previous.moveCount + 1 : this.previous.moveCount) : 1;
    this.chainCount = this.previous ? this.previous.chainCount + 1 : 0;
    this.lastMove = lastMove ? lastMove : (status.resignedPlayer ? {resign: status.resignedPlayer} : lastMove);
    this.moves = this.previous ? this.previous.moves.concat([this.lastMove]) : [];

    this.cells = cells;
    this.allCells = Object.values(this.cells)
      .map(row => Object.values(row))
      .reduce((total, current) => total.concat(current));
    this.rowsAndColumns = this.constructor.ROWS.map(y => ({
      y,
      cells: this.constructor.COLUMNS.map(x => this.cells[y][x]),
    }));

    const {nextPlayer, moveType, availableMoves, canUndo, resignedPlayer} = status;
    this.nextPlayer = nextPlayer;
    this.moveType = moveType;
    this.availableMoves = availableMoves;
    this.canUndo = canUndo;
    this.canTakeMoveBack = !!this.previous;
    this.resignedPlayer = resignedPlayer;
    this.moveNotation = resignedPlayer
      ? this.constructor.RESIGNED_NOTATION[resignedPlayer]
      : (lastMove
        ? this.constructor.MOVE_NOTATION[lastMove.y][lastMove.x]
        : '');
    this.fullNotation = `${this.previous ? this.previous.fullNotation : ''}${this.moveNotation}`;
    this.compressedFullNotation = this.fullNotation
      .split(/(..)/)
      .filter(part => part)
      .map(part => this.constructor.NOTATION_COMPRESSION[part])
      .join('');

    this.winner = this.getWinner();
    if (this.winner) {
      this.finished = true;
    } else if (!this.hasAvailableMove(this.availableMoves)) {
      this.finished = true;
      this.winner = this.constructor.OTHER_PLAYER[this.nextPlayer];
    } else {
      this.finished = false;
    }

    if (this.finished) {
      this.availableMoves = this.constructor.noMovesAreAvailable();
    }
  }

  serialize() {
    return this.serializeCompact();
  }

  serializeCompact() {
    return {
      moves: this.moves,
    };
  }

  serializeVerbose() {
    return {
      cells: this.cells,
      status: {
        nextPlayer: this.nextPlayer,
        moveType: this.moveType,
        availableMoves: this.availableMoves,
        canUndo: this.canUndo,
        resignedPlayer: this.resignedPlayer,
      },
      previous: this.previous ? this.previous.serialize() : null,
      lastMove: this.lastMove,
      isNextMove: this.isNextMove,
    };
  }

  static deserialize(serialized) {
    if (serialized.moves) {
      return this.deserializeCompact(serialized);
    } else {
      return this.deserializeVerbose(serialized);
    }
  }

  static deserializeCompact({moves}) {
    return this.fromMoves(moves);
  }

  static deserializeVerbose({cells, status, previous, lastMove, isNextMove}) {
    if (previous) {
      previous = this.deserialize(previous);
    }
    return new this(cells, status, previous, lastMove, isNextMove);
  }

  static getInitialCells() {
    const cells = {};
    for (const y of this.ROWS) {
      cells[y] = {};
      for (const x of this.COLUMNS) {
        cells[y][x] = {
          x, y,
          player: null,
          worker: null,
          level: 0,
        };
      }
    }

    return cells;
  }

  static getInitialStatus() {
    return  {
      nextPlayer: this.PLAYER_A,
      moveType: this.MOVE_TYPE_PLACE_FIRST_WORKER,
      finished: false,
      winner: null,
      availableMoves: this.allMovesAreAvailable(),
      canUndo: false,
    };
  }

  checkCoordinatesAreValid({x, y}) {
    if (Math.floor(x) !== x || Math.floor(y) !== y) {
      throw new Error(`Coordinates '${JSON.stringify({x, y})}' are not valid`);
    }
    if (this.availableMoves[y] === undefined || this.availableMoves[y][x] === undefined) {
      throw new Error(`Coordinates '${JSON.stringify({x, y})}' are out of bounds`);
    }
  }

  getAvailableCoordinates(availableMoves = this.availableMoves) {
    return availableMoves
      .map((row, y) => row
        .map((available, x) => available ? {x, y} : null)
        .filter(coordinates => coordinates))
      .reduce((total, current) => total.concat(current));
  }

  hasAvailableMove(availableMoves = this.availableMoves) {
    return this.getAvailableCoordinates(availableMoves).length > 0;
  }

  getWinner() {
    if (this.resignedPlayer) {
      return this.constructor.OTHER_PLAYER[this.resignedPlayer];
    }

    const winningCell = this.allCells.find(cell => cell.player && cell.level === 3);
    if (!winningCell) {
      return null;
    }

    return winningCell.player;
  }

  static allMovesAreAvailable() {
    return this.ROWS.map(() => this.COLUMNS.map(() => true));
  }

  static noMovesAreAvailable() {
    return this.ROWS.map(() => this.COLUMNS.map(() => false));
  }

  getEmptyCellsAvailableMoves(cells) {
    return this.constructor.ROWS.map(y => this.constructor.COLUMNS.map(x => !cells[y][x].player));
  }

  getPlayerAvailableMoves(cells, player) {
    return this.constructor.ROWS.map(y => this.constructor.COLUMNS.map(x => {
      if (cells[y][x].player !== player) {
        return false;
      }

      return this.hasAvailableMove(this.getMovableAvailableMoves(cells, {x, y}));
    }));
  }

  getMovableAvailableMoves(cells, coordinates) {
    const cell = cells[coordinates.y][coordinates.x];
    const maximumLevel = cell.level + 1;
    return this.constructor.ROWS.map(y => this.constructor.COLUMNS.map(x => (
      Math.abs(x - coordinates.x) <= 1
      && Math.abs(y - coordinates.y) <= 1
      && !cells[y][x].player
      && cells[y][x].level <= 3
      && cells[y][x].level <= maximumLevel
    )));
  }

  getBuildableAvailableMoves(cells, coordinates) {
    return this.constructor.ROWS.map(y => this.constructor.COLUMNS.map(x => (
      Math.abs(x - coordinates.x) <= 1
      && Math.abs(y - coordinates.y) <= 1
      && !cells[y][x].player
      && cells[y][x].level < 4
    )));
  }

  checkCanMakeMove(expectedMoveType, coordinates, targetCoordinates) {
    if (this.finished) {
      throw new Error("The game has already finished");
    }
    if (this.moveType !== expectedMoveType) {
      throw new Error(`You cannot perform move of type "${expectedMoveType}": you need to perform "${this.moveType}"`);
    }
    this.checkCoordinatesAreValid(coordinates);
    if (targetCoordinates) {
      this.checkCoordinatesAreValid(targetCoordinates);
    }
    if (!this.availableMoves[coordinates.y][coordinates.x]) {
      throw new Error(`Move ${JSON.stringify(coordinates)} is not one of the available ones`);
    }
  }

  resign(player) {
    return this.createStep(this.cells, {
      nextPlayer: this.nextPlayer,
      moveType: this.moveType,
      availableMoves: this.availableMoves,
      canUndo: false,
      resignedPlayer: player,
    }, {resign: player});
  }

  makeMove(coordinates) {
    if (coordinates.resign) {
      return this.resign(coordinates.resign);
    }
    const makeMoveMethods = {
      [this.constructor.MOVE_TYPE_PLACE_FIRST_WORKER]: this.placeFirstWorker,
      [this.constructor.MOVE_TYPE_PLACE_SECOND_WORKER]: this.placeSecondWorker,
      [this.constructor.MOVE_TYPE_SELECT_WORKER_TO_MOVE]: this.selectWorkerToMove,
      [this.constructor.MOVE_TYPE_MOVE_FIRST_WORKER]: this.moveFirstWorker,
      [this.constructor.MOVE_TYPE_MOVE_SECOND_WORKER]: this.moveSecondWorker,
      [this.constructor.MOVE_TYPE_BUILD_AROUND_WORKER]: this.buildAroundWorker,
    };
    const makeMoveMethod = makeMoveMethods[this.moveType];
    if (!makeMoveMethod) {
      throw new Error(`Don't know how to perform move of type "${this.moveType}"`);
    }
    return makeMoveMethod.bind(this)(coordinates);
  }

  undo() {
    if (!this.canUndo) {
      throw new Error("Cannot undo");
    }

    return this.previous;
  }

  takeMoveBack() {
    if (!this.canTakeMoveBack) {
      throw new Error("Cannot take move back");
    }

    return this.previous;
  }

  placeFirstWorker({x, y}) {
    this.checkCanMakeMove(this.constructor.MOVE_TYPE_PLACE_FIRST_WORKER, {x, y});

    const cells = {
      ...this.cells,
      [y]: {
        ...this.cells[y],
        [x]: {
          ...this.cells[y][x],
          player: this.nextPlayer,
          worker: this.constructor.WORKER_FIRST,
        },
      },
    };
    return this.createStep(cells, {
      nextPlayer: this.nextPlayer,
      moveType: this.constructor.MOVE_TYPE_PLACE_SECOND_WORKER,
      availableMoves: this.getEmptyCellsAvailableMoves(cells),
      canUndo: true,
      resignedPlayer: null,
    }, {x, y});
  }

  placeSecondWorker({x, y}) {
    this.checkCanMakeMove(this.constructor.MOVE_TYPE_PLACE_SECOND_WORKER, {x, y});

    const cells = {
      ...this.cells,
      [y]: {
        ...this.cells[y],
        [x]: {
          ...this.cells[y][x],
          player: this.nextPlayer,
          worker: this.constructor.WORKER_SECOND,
        },
      },
    };
    const nextPlayer = this.constructor.OTHER_PLAYER[this.nextPlayer];
    return this.createNext(cells, {
      nextPlayer: nextPlayer,
      moveType: nextPlayer === this.constructor.PLAYER_A
        ? this.constructor.MOVE_TYPE_SELECT_WORKER_TO_MOVE
        : this.constructor.MOVE_TYPE_PLACE_FIRST_WORKER,
      availableMoves: nextPlayer === this.constructor.PLAYER_A
        ? this.getPlayerAvailableMoves(cells, nextPlayer)
        : this.getEmptyCellsAvailableMoves(cells),
      canUndo: false,
      resignedPlayer: null,
    }, {x, y});
  }

  selectWorkerToMove({x, y}) {
    this.checkCanMakeMove(this.constructor.MOVE_TYPE_SELECT_WORKER_TO_MOVE, {x, y});

    const cell = this.cells[y][x];
    return this.createStep(this.cells, {
      nextPlayer: this.nextPlayer,
      moveType: cell.worker === this.constructor.WORKER_FIRST
        ? this.constructor.MOVE_TYPE_MOVE_FIRST_WORKER
        : this.constructor.MOVE_TYPE_MOVE_SECOND_WORKER,
      availableMoves: this.getMovableAvailableMoves(this.cells, {x, y}),
      canUndo: true,
      resignedPlayer: null,
    }, {x, y});
  }

  moveWorker(to, worker) {
    const fromCell = this.allCells.find(cell => cell.player === this.nextPlayer && cell.worker === worker);
    const toCell = this.cells[to.y][to.x];
    let cells = {
      ...this.cells,
      [fromCell.y]: {
        ...this.cells[fromCell.y],
        [fromCell.x]: {
          ...fromCell,
          player: null,
          worker: null,
        },
      },
    };
    cells = {
      ...cells,
      [to.y]: {
        ...cells[to.y],
        [to.x]: {
          ...toCell,
          player: fromCell.player,
          worker: fromCell.worker,
        },
      },
    };
    return this.createStep(cells, {
      nextPlayer: this.nextPlayer,
      moveType: this.constructor.MOVE_TYPE_BUILD_AROUND_WORKER,
      availableMoves: this.getBuildableAvailableMoves(cells, to),
      canUndo: true,
      resignedPlayer: null,
    }, {x: to.x, y: to.y});
  }

  moveFirstWorker({x, y}) {
    this.checkCanMakeMove(this.constructor.MOVE_TYPE_MOVE_FIRST_WORKER, {x, y});

    return this.moveWorker({x, y}, this.constructor.WORKER_FIRST)
  }

  moveSecondWorker({x, y}) {
    this.checkCanMakeMove(this.constructor.MOVE_TYPE_MOVE_SECOND_WORKER, {x, y});

    return this.moveWorker({x, y}, this.constructor.WORKER_SECOND)
  }

  buildAroundWorker({x, y}) {
    this.checkCanMakeMove(this.constructor.MOVE_TYPE_BUILD_AROUND_WORKER, {x, y});

    const cells = {
      ...this.cells,
      [y]: {
        ...this.cells[y],
        [x]: {
          ...this.cells[y][x],
          level: this.cells[y][x].level + 1,
        },
      },
    };
    const nextPlayer = this.constructor.OTHER_PLAYER[this.nextPlayer];
    return this.createNext(cells, {
      nextPlayer: nextPlayer,
      moveType: this.constructor.MOVE_TYPE_SELECT_WORKER_TO_MOVE,
      availableMoves: this.getPlayerAvailableMoves(cells, nextPlayer),
      canUndo: false,
      resignedPlayer: null,
    }, {x, y});
  }
}

module.exports = {
  Game,
};
