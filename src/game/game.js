const _ = require('lodash');

class InvalidMoveError extends Error {}

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
  static WORKERS = [this.WORKER_FIRST, this.WORKER_SECOND];

  static MOVE_TYPE_PLACE_FIRST_WORKER = 'place-first-worker';
  static MOVE_TYPE_PLACE_SECOND_WORKER = 'place-second-worker';
  static MOVE_TYPE_SELECT_WORKER_TO_MOVE = 'select-worker-to-move';
  static MOVE_TYPE_MOVE_FIRST_WORKER = 'move-first-worker';
  static MOVE_TYPE_MOVE_SECOND_WORKER = 'move-second-worker';
  static MOVE_TYPE_BUILD_AROUND_WORKER = 'build-around-worker';

  static MOVE_TYPES_START_OF_TURN = [this.MOVE_TYPE_PLACE_FIRST_WORKER, this.MOVE_TYPE_SELECT_WORKER_TO_MOVE];
  static MOVE_TYPES_PLACE_WORKER = [this.MOVE_TYPE_PLACE_FIRST_WORKER, this.MOVE_TYPE_PLACE_SECOND_WORKER];
  static MOVE_TYPES_MOVE_WORKER = [this.MOVE_TYPE_MOVE_FIRST_WORKER, this.MOVE_TYPE_MOVE_SECOND_WORKER];
  static MOVE_TYPES_MOVE_OR_BUILD = [...this.MOVE_TYPES_MOVE_WORKER, this.MOVE_TYPE_BUILD_AROUND_WORKER];

  static ROWS = Array.from({length: 5}, (value, index) => index);
  static COLUMNS = Array.from({length: 5}, (value, index) => index);
  static MOVE_NOTATION = this.ROWS.map(y => this.COLUMNS.map(x =>
    `${['A', 'B', 'C', 'D', 'E'][x]}${['1', '2', '3', '4', '5'][y]}`));
  static MOVE_RESIGNED_NOTATION = {
    [this.PLAYER_A]: 'RA',
    [this.PLAYER_B]: 'RB',
  };
  static MOVE_REVERSE_NOTATION = {
    ..._.fromPairs(_.flatten(this.ROWS.map(y => this.COLUMNS.map(x =>
      [`${['A', 'B', 'C', 'D', 'E'][x]}${['1', '2', '3', '4', '5'][y]}`, {x, y}])))),
    'RA': [{resign: this.PLAYER_A}],
    'RB': [{resign: this.PLAYER_B}],
  };
  static MOVE_NOTATION_COMPRESSION = _.fromPairs(Object.keys(this.MOVE_REVERSE_NOTATION).sort().map((value, index) =>
    [value, String.fromCharCode(index < 26 ? 65 + index : 48 + (index - 26))]));
  static MOVE_NOTATION_DECOMPRESSION = _.fromPairs(Object.keys(this.MOVE_REVERSE_NOTATION).sort().map((value, index) =>
    [String.fromCharCode(index < 26 ? 65 + index : 48 + (index - 26)), this.MOVE_REVERSE_NOTATION[value]]));

  static POSITION_NOTATION = _.fromPairs([0, 1, 2, 3, 4].map(
    level => [level, _.fromPairs([null, this.PLAYER_A, this.PLAYER_B].map(
      player => [player, `${level}-${player}`]))]));
  static POSITION_REVERSE_NOTATION = _.fromPairs(_.flatten(Object.entries(this.POSITION_NOTATION).map(
    ([levelStr, notations]) => Object.entries(notations).map(
      ([playerStr, notation]) => [notation, {level: parseInt(levelStr), player: playerStr === "null" ? null : playerStr}]))));
  static POSITION_NOTATION_COMPRESSION_MAP = _.fromPairs(_.flatten(Object.entries(this.POSITION_NOTATION).map(
    ([, notations]) => Object.entries(notations).map(
      ([, notation]) => notation))).map((notation, index) => [notation, String.fromCharCode(65 + index)]));
  static POSITION_NOTATION_COMPRESSION = _.fromPairs(Object.entries(this.POSITION_NOTATION).map(
    ([levelStr, notations]) => [levelStr, _.fromPairs(Object.entries(notations).map(
      ([playerStr, notation]) => [playerStr, this.POSITION_NOTATION_COMPRESSION_MAP[notation]]))]));
  static POSITION_NOTATION_DECOMPRESSION = _.fromPairs(Object.entries(this.POSITION_NOTATION_COMPRESSION_MAP).map(
    ([notation, compressedNotation]) => [compressedNotation, this.POSITION_REVERSE_NOTATION[notation]]));

  static create() {
    const rowsAndColumns = this.getInitialRowsAndColumns();
    const status = this.getInitialStatus();
    return new this(rowsAndColumns, status, null, null, false);
  }

  static fromMoves(moves) {
    let game = this.create();
    game = game.makeMoves(moves);

    return game;
  }

  static fromRowsAndColumns(rowsAndColumns) {
    if (rowsAndColumns.length !== 5) {
      throw new Error(`Expected 5 rows but got ${rowsAndColumns.length}`);
    }
    if (rowsAndColumns.find(row => row.cells.length !== 5)) {
      throw new Error(`Expected 5 columns but some rows had a different number`);
    }
    if (rowsAndColumns.find((row, y) => row.y !== y)) {
      throw new Error(`Some rows had invalid \`y\``);
    }
    if (rowsAndColumns.find(row => row.cells.find((cell, x) => cell.x !== x || cell.y !== row.y))) {
      throw new Error(`Some cells had invalid \`x\` or \`y\``);
    }
    const hasInvalidPlayerOrWorker = cell => (
      (cell.player && !this.PLAYERS.includes(cell.player))
      || (cell.worker && !this.WORKERS.includes(cell.worker))
    );
    if (this.findCell(rowsAndColumns, hasInvalidPlayerOrWorker)) {
      throw new Error(`Some cells had invalid player or worker`);
    }
    if (this.findCell(rowsAndColumns, cell => ![0, 1, 2, 3, 4].includes(cell.level))) {
      throw new Error(`Some cells have invalid level`);
    }
    const playerACount = this.findCells(rowsAndColumns, cell => cell.player === this.PLAYER_A).length;
    const playerBCount = this.findCells(rowsAndColumns, cell => cell.player === this.PLAYER_B).length;
    if (playerACount > 2 || playerBCount > 2) {
      throw new Error(
        `Players can have at most 2 workers, but player A has ${playerACount} and player B has ${playerBCount}`);
    }
    let status;
    const maxLevel = Math.max(..._.flatten(rowsAndColumns.map(row => row.cells.map(cell => cell.level))));
    if (maxLevel === 0) {
      if (playerBCount === 0) {
        if (playerACount === 0) {
          status = {
            nextPlayer: this.PLAYER_A,
            moveType: this.MOVE_TYPE_PLACE_FIRST_WORKER,
            availableMovesMatrix: this.allMovesAreAvailableMatrix(),
            canUndo: false,
            resignedPlayer: null,
          };
        } else if (playerACount === 1) {
          status = {
            nextPlayer: this.PLAYER_A,
            moveType: this.MOVE_TYPE_PLACE_SECOND_WORKER,
            availableMovesMatrix: this.getEmptyCellsAvailableMovesMatrix(rowsAndColumns),
            canUndo: false,
            resignedPlayer: null,
          };
        } else {
          const playerAFirstWorker = this.findCell(
            cell => cell.player === this.PLAYER_A && cell.worker === this.WORKER_FIRST);
          const playerASecondWorker = this.findCell(
            cell => cell.player === this.PLAYER_A && cell.worker === this.WORKER_SECOND);
          if (!playerAFirstWorker || !playerASecondWorker) {
            throw new Error(`Could not find both workers of player A`);
          }
          status = {
            nextPlayer: this.PLAYER_B,
            moveType: this.MOVE_TYPE_PLACE_FIRST_WORKER,
            availableMovesMatrix: this.getEmptyCellsAvailableMovesMatrix(rowsAndColumns),
            canUndo: false,
            resignedPlayer: null,
          };
        }
      } else {
        if (playerACount !== 2) {
          throw new Error(`Player A must put both of their workers before player B can place theirs`);
        }
        if (playerBCount === 1) {
          status = {
            nextPlayer: this.PLAYER_B,
            moveType: this.MOVE_TYPE_PLACE_SECOND_WORKER,
            availableMovesMatrix: this.getEmptyCellsAvailableMovesMatrix(rowsAndColumns),
            canUndo: false,
            resignedPlayer: null,
          };
        } else {
          const playerBFirstWorker = this.findCell(
            cell => cell.player === this.PLAYER_B && cell.worker === this.WORKER_FIRST);
          const playerBSecondWorker = this.findCell(
            cell => cell.player === this.PLAYER_B && cell.worker === this.WORKER_SECOND);
          if (!playerBFirstWorker || !playerBSecondWorker) {
            throw new Error(`Could not find both workers of player B`);
          }
          status = {
            nextPlayer: this.PLAYER_A,
            moveType: this.MOVE_TYPE_SELECT_WORKER_TO_MOVE,
            availableMovesMatrix: this.getPlayerAvailableMovesMatrix(rowsAndColumns, this.PLAYER_A),
            canUndo: false,
            resignedPlayer: null,
          };
        }
      }
    } else {
      if (playerACount !== 2 || playerBCount !== 2) {
        throw new Error(`Both players must have placed both of their workers before they can move and build`);
      }

      if (this.findCell(rowsAndColumns, cell => cell.level === 4 && cell.player)) {
        throw new Error(`Some workers are on the 4th level`);
      }
      const wonWorkers = this.findCells(rowsAndColumns, cell => cell.level === 3 && cell.player);
      if (wonWorkers.length > 1) {
        throw new Error(`Too many workers have won`);
      }
      const buildCount = _.sum(_.flatten(rowsAndColumns.map(row => row.cells.map(cell => cell.level))));
      if (buildCount % 2 === 0) {
        status = {
          nextPlayer: this.PLAYER_A,
          moveType: this.MOVE_TYPE_SELECT_WORKER_TO_MOVE,
          availableMovesMatrix: this.getPlayerAvailableMovesMatrix(rowsAndColumns, this.PLAYER_A),
          canUndo: false,
          resignedPlayer: null,
        };
      } else {
        status = {
          nextPlayer: this.PLAYER_B,
          moveType: this.MOVE_TYPE_SELECT_WORKER_TO_MOVE,
          availableMovesMatrix: this.getPlayerAvailableMovesMatrix(rowsAndColumns, this.PLAYER_B),
          canUndo: false,
          resignedPlayer: null,
        };
      }
    }
    return new this(rowsAndColumns, status, null, null, false);
  }

  static fromMoveNotation(fullNotation) {
    const moves = fullNotation
      .split('')
      .map(part => this.MOVE_REVERSE_NOTATION[part]);
    if (moves.filter(move => !move).length) {
      return null;
    }

    try {
      return this.fromMoves(moves, true);
    } catch (e) {
      return this.fromMoves(moves, false);
    }
  }

  static fromCompressedMoveNotation(compressedFullNotation) {
    const moves = compressedFullNotation
      .split('')
      .map(part => this.MOVE_NOTATION_DECOMPRESSION[part]);
    if (moves.filter(move => !move).length) {
      return null;
    }

    try {
      return this.fromMoves(moves, true);
    } catch (e) {
      return this.fromMoves(moves, false);
    }
  }

  static getPositionNotation(rowsAndColumns) {
    return _.flatten(rowsAndColumns.map(
      row => row.cells.map(
        cell => this.POSITION_NOTATION_COMPRESSION[cell.level][cell.player])))
      .join('');
  }

  static fromPositionNotation(notation) {
    const rowsAndColumns = this.ROWS.map(y => ({
      y, cells: this.COLUMNS.map(x => ({
        x, y, ...this.POSITION_REVERSE_NOTATION[notation[y * 5 + x]],
      })),
    }));
    return this.fromPosition(rowsAndColumns);
  }

  static fromCompressedPositionNotation(notation) {
    const rowsAndColumns = this.ROWS.map(y => ({
      y, cells: this.COLUMNS.map(x => ({
        x, y, ...this.POSITION_NOTATION_DECOMPRESSION[notation[y * 5 + x]],
      })),
    }));
    return this.fromPosition(rowsAndColumns);
  }

  static fromPosition(rowsAndColumns) {
    let playerACount = 0, playerBCount = 0;
    for (const x of this.ROWS) {
      for (const y of this.COLUMNS) {
        const cell = rowsAndColumns[y].cells[x];
        if (cell.player === this.PLAYER_A) {
          cell.worker = this.WORKERS[playerACount % 2];
          playerACount += 1;
        } else if (cell.player === this.PLAYER_B) {
          cell.worker = this.WORKERS[playerBCount % 2];
          playerBCount += 1;
        }
      }
    }
    return this.fromRowsAndColumns(rowsAndColumns);
  }

  createStep(rowsAndColumns, status, lastMove) {
    return new this.constructor(rowsAndColumns, status, this, lastMove, false);
  }

  createNext(rowsAndColumns, status, lastMove) {
    return new this.constructor(rowsAndColumns, status, this, lastMove, true);
  }

  constructor(rowsAndColumns, status, previous, lastMove, isNextMove) {
    if (!rowsAndColumns || !status) {
      throw new Error("You need to pass rowsAndColumns, status, and previous game");
    }
    this.previous = previous;
    this.history = (this.previous ? this.previous.history : [])
      .filter(game => !game.canUndo)
      .concat([this]);
    this.previousInHistory = this.history[this.history.length - 2];
    this.fullHistory = (this.previous ? this.previous.fullHistory : []).concat(this);
    this.isNextMove = isNextMove;
    this.moveCount = this.previous ? (isNextMove ? this.previous.moveCount + 1 : this.previous.moveCount) : 1;
    this.chainCount = this.previous ? this.previous.chainCount + 1 : 0;
    this.lastMove = lastMove ? lastMove : (status.resignedPlayer ? {resign: status.resignedPlayer} : lastMove);
    this.moves = this.previous ? this.previous.moves.concat([this.lastMove]) : [];

    this.rowsAndColumns = rowsAndColumns;

    const missingStatusKeys =
      ['nextPlayer', 'moveType', 'availableMovesMatrix', 'canUndo', 'resignedPlayer']
      .filter(key => status[key] === undefined);
    if (missingStatusKeys.length) {
      throw new Error(`Some status keys were missing: ${missingStatusKeys.join(', ')}`);
    }
    const {nextPlayer, moveType, availableMovesMatrix, canUndo, resignedPlayer} = status;
    this.thisPlayer = previous ? previous.nextPlayer : Game.PLAYER_A;
    this.nextPlayer = nextPlayer;
    this.thisMoveType = previous ? previous.moveType : null;
    this.moveType = moveType;
    this.availableMovesMatrix = availableMovesMatrix;
    this.canUndo = canUndo;
    this.canTakeMoveBack = !!this.previous;
    this.resignedPlayer = resignedPlayer;
    this.moveNotation = resignedPlayer
      ? this.constructor.MOVE_RESIGNED_NOTATION[resignedPlayer]
      : (lastMove
        ? this.constructor.MOVE_NOTATION[lastMove.y][lastMove.x]
        : '');
    this.fullNotation = `${this.previous ? this.previous.fullNotation : ''}${this.moveNotation}`;
    this.compressedFullNotation = this.fullNotation
      .split(/(..)/)
      .filter(part => part)
      .map(part => this.constructor.MOVE_NOTATION_COMPRESSION[part])
      .join('');
    this.positionNotation = this.constructor.getPositionNotation(this.rowsAndColumns);

    this.winner = this.getWinner();
    if (this.winner) {
      this.finished = true;
    } else if (!this.constructor.hasAvailableMove(this.availableMovesMatrix)) {
      this.finished = true;
      this.winner = this.constructor.OTHER_PLAYER[this.nextPlayer];
    } else {
      this.finished = false;
    }

    if (this.finished) {
      this.availableMovesMatrix = this.constructor.noMovesAreAvailable();
    }
  }

  static getAvailableMoves(availableMovesMatrix) {
    return _.flatten(availableMovesMatrix
      .map((row, y) => row
        .map((available, x) => available ? {x, y} : null)))
      .filter(move => move);
  }

  serialize() {
    return {
      moves: this.moves,
    };
  }

  static deserialize({moves}) {
    return this.fromMoves(moves);
  }

  static getInitialRowsAndColumns() {
    return this.ROWS.map(y => ({
      y, cells: this.COLUMNS.map(x => ({
        x, y, level: 0, player: null, worker: null,
      })),
    }));
  }

  static getInitialStatus() {
    return  {
      nextPlayer: this.PLAYER_A,
      moveType: this.MOVE_TYPE_PLACE_FIRST_WORKER,
      availableMovesMatrix: this.allMovesAreAvailableMatrix(),
      canUndo: false,
      resignedPlayer: null,
    };
  }

  getPrintout() {
    /* eslint-disable no-useless-computed-key */
    const printMap = {
      [Game.PLAYER_A]: {[0]: 'a', [1]: chalk.bgWhite('b'), [2]: chalk.bgYellow('c'), [3]: chalk.bgRed('d')},
      [Game.PLAYER_B]: {[0]: 'w', [1]: chalk.bgWhite('x'), [2]: chalk.bgYellow('y'), [3]: chalk.bgRed('z')},
      [null]: {[0]: ' ', [1]: chalk.bgWhite(' '), [2]: chalk.bgYellow(' '), [3]: chalk.bgRed(' '), [4]: chalk.bgBlue(' ')},
    };
    /* eslint-enable no-useless-computed-key */
    const cellsPrintout = this.rowsAndColumns
      .map(row => row.cells
        .map(cell => printMap[cell.player][cell.level])
        .join(''))
      .join('\n');
    const nextPlayerMap = {
      [Game.PLAYER_A]: 'A', [Game.PLAYER_B]: 'B',
    };
    const nextPlayerPrintout = nextPlayerMap[this.nextPlayer];
    const winnerMap = {
      [Game.PLAYER_A]: 'A', [Game.PLAYER_B]: 'B', [null]: '+',
    };
    const winnerPrintout = winnerMap[this.winner];
    return (
      `${nextPlayerPrintout}-----${winnerPrintout}\n`
      + cellsPrintout.split('\n').map(row => `|${chalk.black(row)}|`).join('\n')
      + '\n+-----+'
    );
  }

  checkCoordinatesAreValid({x, y}) {
    if (Math.floor(x) !== x || Math.floor(y) !== y) {
      throw new InvalidMoveError(`Coordinates '${JSON.stringify({x, y})}' are not valid`);
    }
    if (this.availableMovesMatrix[y] === undefined || this.availableMovesMatrix[y][x] === undefined) {
      throw new InvalidMoveError(`Coordinates '${JSON.stringify({x, y})}' are out of bounds`);
    }
  }

  static hasAvailableMove(availableMovesMatrix) {
    return this.getAvailableMoves(availableMovesMatrix).length > 0;
  }

  isMoveAvailable({x, y}) {
    return this.availableMovesMatrix[y][x];
  }

  static findCell(rowsAndColumns, condition) {
    return rowsAndColumns.map(row => row.cells.find(condition)).find(cell => cell);
  }

  static findCells(rowsAndColumns, condition) {
    return _.flatten(rowsAndColumns.map(row => row.cells.filter(condition)));
  }

  findCell(condition) {
    return this.constructor.findCell(this.rowsAndColumns, condition);
  }

  findCells(condition) {
    return this.constructor.findCells(this.rowsAndColumns, condition);
  }

  static canPlayerWin(rowsAndColumns, player) {
    const playerCells = this.findCells(rowsAndColumns, cell => cell.player === player && cell.level === 2);
    if (!playerCells.length) {
      return false;
    }
    const playerWinningMoves = this.findCells(rowsAndColumns, cell => (
      cell.level === 3
      && playerCells.find(playerCell => (
        Math.abs(cell.x - playerCell.x) <= 1
        && Math.abs(cell.y - playerCell.y) <= 1
      ))
    ));

    return playerWinningMoves.length > 0;
  }

  getWinner() {
    if (this.resignedPlayer) {
      return this.constructor.OTHER_PLAYER[this.resignedPlayer];
    }

    const winningCell = this.findCell(cell => cell.player && cell.level === 3);
    if (winningCell) {
      return winningCell.player;
    }

    if (!this.canUndo && this.constructor.canPlayerWin(this.rowsAndColumns, this.nextPlayer)) {
      return this.nextPlayer;
    }

    return null;
  }

  static allMovesAreAvailableMatrix() {
    return this.ROWS.map(() => this.COLUMNS.map(() => true));
  }

  static noMovesAreAvailable() {
    return this.ROWS.map(() => this.COLUMNS.map(() => false));
  }

  static getEmptyCellsAvailableMovesMatrix(rowsAndColumns) {
    return this.getAvailableMovesMatrix(rowsAndColumns, cell => !cell.player);
  }

  static getPlayerAvailableMovesMatrix(rowsAndColumns, player) {
    return this.getAvailableMovesMatrix(rowsAndColumns, cell => {
      if (cell.player !== player) {
        return false;
      }

      return this.hasAvailableMove(this.getMovableAvailableMovesMatrix(rowsAndColumns, cell));
    });
  }

  static getMovableAvailableMovesMatrix(rowsAndColumns, coordinates) {
    const fromCell = rowsAndColumns[coordinates.y].cells[coordinates.x];
    const maximumLevel = fromCell.level + 1;
    return this.getAvailableMovesMatrix(rowsAndColumns, cell => (
      Math.abs(cell.x - coordinates.x) <= 1
      && Math.abs(cell.y - coordinates.y) <= 1
      && !cell.player
      && cell.level <= 3
      && cell.level <= maximumLevel
      && (this.hasAvailableMove(this.getBuildableAvailableMovesMatrix(this.updateCells(rowsAndColumns, ...[
        {x: fromCell.x, y: fromCell.y, player: null, worker: null},
        {x: cell.x, y: cell.y, player: fromCell.player, worker: fromCell.worker}
      ]), cell)))
    ));
  }

  static getBuildableAvailableMovesMatrix(rowsAndColumns, coordinates) {
    const fromCell = rowsAndColumns[coordinates.y].cells[coordinates.x];
    return this.getAvailableMovesMatrix(rowsAndColumns, cell => (
      Math.abs(cell.x - coordinates.x) <= 1
      && Math.abs(cell.y - coordinates.y) <= 1
      && !cell.player
      && cell.level < 4
      && (!this.canPlayerWin(this.updateCells(rowsAndColumns, ...[
        {x: cell.x, y: cell.y, level: cell.level + 1},
      ]), this.OTHER_PLAYER[fromCell.player]))
    ));
  }

  static getAvailableMovesMatrix(rowsAndColumns, isMoveAvailable) {
    return rowsAndColumns.map(row => row.cells.map(isMoveAvailable));
  }

  checkCanMakeMove(expectedMoveType, coordinates, targetCoordinates) {
    if (this.finished) {
      throw new InvalidMoveError("The game has already finished");
    }
    if (this.moveType !== expectedMoveType) {
      throw new InvalidMoveError(`You cannot perform move of type "${expectedMoveType}": you need to perform "${this.moveType}"`);
    }
    this.checkCoordinatesAreValid(coordinates);
    if (targetCoordinates) {
      this.checkCoordinatesAreValid(targetCoordinates);
    }
    if (!this.availableMovesMatrix[coordinates.y][coordinates.x]) {
      throw new Error(`Move ${JSON.stringify(coordinates)} is not one of the available ones`);
    }
  }

  resign(player) {
    return this.createStep(this.rowsAndColumns, {
      nextPlayer: this.nextPlayer,
      moveType: this.moveType,
      availableMovesMatrix: this.availableMovesMatrix,
      canUndo: false,
      resignedPlayer: player,
    }, {resign: player});
  }

  static updateCells(rowsAndColumns, ...newCells) {
    const updates = {};
    for (const update of newCells) {
      updates[update.y] = updates[update.y] || {};
      updates[update.y][update.x] = update;
    }
    return rowsAndColumns.map(row => !updates[row.y] ? row : ({
      ...row,
      cells: row.cells.map(cell => !updates[cell.y][cell.x] ? cell : ({
        ...cell,
        ...updates[cell.y][cell.x],
      })),
    }));
  }

  makeMoves(moves) {
    let game = this;
    for (const move of moves) {
      game = game.makeMove(move);
    }

    return game;
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
      throw new InvalidMoveError(`Don't know how to perform move of type "${this.moveType}"`);
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

    const rowsAndColumns = this.constructor.updateCells(this.rowsAndColumns, {
      x, y,
      player: this.nextPlayer,
      worker: this.constructor.WORKER_FIRST,
    });
    return this.createStep(rowsAndColumns, {
      nextPlayer: this.nextPlayer,
      moveType: this.constructor.MOVE_TYPE_PLACE_SECOND_WORKER,
      availableMovesMatrix: this.constructor.getEmptyCellsAvailableMovesMatrix(rowsAndColumns),
      canUndo: true,
      resignedPlayer: null,
    }, {x, y});
  }

  placeSecondWorker({x, y}) {
    this.checkCanMakeMove(this.constructor.MOVE_TYPE_PLACE_SECOND_WORKER, {x, y});

    const rowsAndColumns = this.constructor.updateCells(this.rowsAndColumns, {
      x, y,
      player: this.nextPlayer,
      worker: this.constructor.WORKER_SECOND,
    });
    const nextPlayer = this.constructor.OTHER_PLAYER[this.nextPlayer];
    return this.createNext(rowsAndColumns, {
      nextPlayer: nextPlayer,
      moveType: nextPlayer === this.constructor.PLAYER_A
        ? this.constructor.MOVE_TYPE_SELECT_WORKER_TO_MOVE
        : this.constructor.MOVE_TYPE_PLACE_FIRST_WORKER,
      availableMovesMatrix: nextPlayer === this.constructor.PLAYER_A
        ? this.constructor.getPlayerAvailableMovesMatrix(rowsAndColumns, nextPlayer)
        : this.constructor.getEmptyCellsAvailableMovesMatrix(rowsAndColumns),
      canUndo: false,
      resignedPlayer: null,
    }, {x, y});
  }

  selectWorkerToMove({x, y}) {
    this.checkCanMakeMove(this.constructor.MOVE_TYPE_SELECT_WORKER_TO_MOVE, {x, y});

    const cell = this.rowsAndColumns[y].cells[x];
    return this.createStep(this.rowsAndColumns, {
      nextPlayer: this.nextPlayer,
      moveType: cell.worker === this.constructor.WORKER_FIRST
        ? this.constructor.MOVE_TYPE_MOVE_FIRST_WORKER
        : this.constructor.MOVE_TYPE_MOVE_SECOND_WORKER,
      availableMovesMatrix: this.constructor.getMovableAvailableMovesMatrix(this.rowsAndColumns, {x, y}),
      canUndo: true,
      resignedPlayer: null,
    }, {x, y});
  }

  moveWorker(to, worker) {
    const fromCell = this.findCell(cell => cell.player === this.nextPlayer && cell.worker === worker);
    const toCell = this.rowsAndColumns[to.y].cells[to.x];
    const rowsAndColumns = this.constructor.updateCells(this.rowsAndColumns, ...[
      {x: fromCell.x, y: fromCell.y, player: null, worker: null},
      {x: toCell.x, y: toCell.y, player: fromCell.player, worker: fromCell.worker},
    ]);
    return this.createStep(rowsAndColumns, {
      nextPlayer: this.nextPlayer,
      moveType: this.constructor.MOVE_TYPE_BUILD_AROUND_WORKER,
      availableMovesMatrix: this.constructor.getBuildableAvailableMovesMatrix(rowsAndColumns, to),
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

    const rowsAndColumns = this.constructor.updateCells(this.rowsAndColumns, {
      x, y, level: this.rowsAndColumns[y].cells[x].level + 1,
    });
    const nextPlayer = this.constructor.OTHER_PLAYER[this.nextPlayer];
    return this.createNext(rowsAndColumns, {
      nextPlayer: nextPlayer,
      moveType: this.constructor.MOVE_TYPE_SELECT_WORKER_TO_MOVE,
      availableMovesMatrix: this.constructor.getPlayerAvailableMovesMatrix(rowsAndColumns, nextPlayer),
      canUndo: false,
      resignedPlayer: null,
    }, {x, y});
  }
}

module.exports = {
  Game,
  InvalidMoveError,
};
