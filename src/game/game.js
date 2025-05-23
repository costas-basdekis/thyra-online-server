const _ = require('lodash');
const chalk = require('chalk');

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
          const playerAFirstWorker = this.findCell(rowsAndColumns,
            cell => cell.player === this.PLAYER_A && cell.worker === this.WORKER_FIRST);
          const playerASecondWorker = this.findCell(rowsAndColumns,
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
          const playerBFirstWorker = this.findCell(rowsAndColumns,
            cell => cell.player === this.PLAYER_B && cell.worker === this.WORKER_FIRST);
          const playerBSecondWorker = this.findCell(rowsAndColumns,
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

  static isValidCompressedPositionNotation(notation) {
    try {
      this.fromCompressedPositionNotation(notation);
      return true;
    } catch(e) {
      return false;
    }
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

    this.rowsAndColumns = rowsAndColumns;

    const missingStatusKeys =
      ['nextPlayer', 'moveType', 'availableMovesMatrix', 'canUndo', 'resignedPlayer']
      .filter(key => status[key] === undefined);
    if (missingStatusKeys.length) {
      throw new Error(`Some status keys were missing: ${missingStatusKeys.join(', ')}`);
    }
    this.status = status;
    this.moveType = this.status.moveType;
    this.availableMovesMatrix = this.status.availableMovesMatrix;
    this.resignedPlayer = this.status.resignedPlayer;
    this.nextPlayer = this.status.nextPlayer;
    this.canUndo = this.status.canUndo;
    this.lastMove = lastMove ? lastMove : (this.resignedPlayer ? {resign: this.resignedPlayer} : lastMove);
    this.isNextMove = isNextMove;

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

  _getProperty(name, func) {
    if (!this.hasOwnProperty(name)) {
      // if (this._getPropertyDependencyCycle.includes(name)) {
      //   throw new Error(`Dependency cycle detected for properties: ${this._getPropertyDependencyCycle.concat([name]).join(', ')}`);
      // }
      // this._getPropertyDependencyCycle.push(name);
      this[name] = func();
      // if (this._getPropertyDependencyCycle[this._getPropertyDependencyCycle.length - 1] !== name) {
      //   throw new Error(`Expected the last property set being '${name}', but it was ${this._getPropertyDependencyCycle.join(', ')}`);
      // }
      // this._getPropertyDependencyCycle.pop();
    }

    return this[name];

  }
  // _getPropertyDependencyCycle = [];

  get history() {
    return this._getProperty('_history', () => (this.previous ? this.previous.history : [])
      .filter(game => !game.canUndo)
      .concat([this]));
  }

  get previousInHistory() {
    return this._getProperty('_previousInHistory', () => this.history[this.history.length - 2]);
  }

  get fullHistory() {
    return this._getProperty('_fullHistory', ()=> (this.previous ? this.previous.fullHistory : []).concat(this))
  };
  get moveCount() {
    return this._getProperty('_moveCount', ()=> this.previous ? (this.isNextMove ? this.previous.moveCount + 1 : this.previous.moveCount) : 1)
  };
  get chainCount() {
    return this._getProperty('_chainCount', ()=> this.previous ? this.previous.chainCount + 1 : 0)
  };
  get moves() {
    return this._getProperty('_moves', ()=> this.previous ? this.previous.moves.concat([this.lastMove]) : [])
  };
  get lastMovesInHistory() {
    return this._getProperty('_lastMovesInHistory', ()=> this.fullHistory
      .slice(this.fullHistory.indexOf(this.previousInHistory) + 1)
      .map(game => game.lastMove))
  };
  get path() {
    return this._getProperty('_path', ()=> this.previousInHistory
      ? this.previousInHistory.path.concat([this.lastMovesInHistory])
      : [])
  };

  get thisPlayer() {
    return this._getProperty('_thisPlayer', () => this.previous ? this.previous.nextPlayer : Game.PLAYER_A);
  }
  get thisMoveType() {
    return this._getProperty('_thisMoveType', () => this.previous ? this.previous.moveType : null);
  }
  get canTakeMoveBack() {
    return this._getProperty('_canTakeMoveBack', () => !!this.previous);
  }
  get moveNotation() {return this._getProperty('_moveNotation', () => this.resignedPlayer
    ? this.constructor.MOVE_RESIGNED_NOTATION[this.resignedPlayer]
    : (this.lastMove
      ? this.constructor.MOVE_NOTATION[this.lastMove.y][this.lastMove.x]
      : ''));
  }
  get fullNotation() {
    return this._getProperty('_fullNotation', () => `${this.previous ? this.previous.fullNotation : ''}${this.moveNotation}`);
  }
  get compressedFullNotation() {
    return this._getProperty('_compressedFullNotation', () => this.fullNotation
      .split(/(..)/)
      .filter(part => part)
      .map(part => this.constructor.MOVE_NOTATION_COMPRESSION[part])
      .join(''));
  }
  get positionNotation() {
    return this._getProperty('_positionNotation', () => this.constructor.getPositionNotation(this.rowsAndColumns));
  }
  get startingWorkersPositionGame() {
    return this._getProperty('_startingWorkersPositionGame', () => {
      if (this.history.length < 3) {
        return null;
      }
      return this.history[2];
    });
  }
  get startingWorkersPositionNormalisedPositionNotation() {
    return this._getProperty('_startingWorkersPositionNormalisedPositionNotation', () => {
      if (!this.startingWorkersPositionGame) {
        return null;
      }
      return this.startingWorkersPositionGame.normalisedPositionNotation;
    });
  }
  get normalisedPositionNotation() {
    return this._getProperty('_normalisedPositionNotation', () => {
      const [normalisedPositionNotation] = this.normalisedPositionNotationAndTransformationName;
      return normalisedPositionNotation;
    });
  }
  get normalisedPositionNotationAndTransformationName() {
    return this._getProperty('_normalisedPositionNotationAndTransformationName', () => {
      const normalisedPositionNotation = this.allPositionNotations[0];
      return [normalisedPositionNotation, (this.transformationNameByPositionNotation)[normalisedPositionNotation]];
    });
  }
  get transformationNameByPositionNotation() {
    return this._getProperty('_transformationNameByPositionNotation', () => (
      _.fromPairs(Object.entries(this.constructor.transformationMap)
      .map(([name, transformation]) => [name, transformation || this.constructor.noTransformation])
      .map(([name, transformation]) => [Game.Classic.fromRowsAndColumns(transformation(this.rowsAndColumns)).positionNotation, name]))
    ));
  }

  get allPositionNotations() {
    return this._getProperty('_allPositionNotations', () => (
      Object.keys(this.transformationNameByPositionNotation).sort().reverse()
    ));
  }

  get currentAndNormalisedPositionNotations() {
    return this._getProperty('_currentAndNormalisedPositionNotations', () => [
      this.positionNotation,
      this.normalisedPositionNotation,
    ]);
  }

  get currentAndNormalisedPositionNotationsHistory() {
    return this.history.map(game => game.currentAndNormalisedPositionNotations);
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

  static areCellsNeighbours(lhs, rhs) {
    throw new Error('Not implemented `areCellsNeighbours`');
  }

  static canPlayerWin(rowsAndColumns, player) {
    const playerCells = this.findCells(rowsAndColumns, cell => cell.player === player && cell.level === 2);
    if (!playerCells.length) {
      return false;
    }
    const playerWinningMoves = this.findCells(rowsAndColumns, cell => (
      cell.level === 3
      && playerCells.find(playerCell => this.areCellsNeighbours(cell, playerCell))
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
      this.areCellsNeighbours(cell, coordinates)
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
      this.areCellsNeighbours(cell, coordinates)
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
      throw new InvalidMoveError(`Move ${JSON.stringify(coordinates)} is not one of the available ones`);
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

  getAvailableMoves() {
    if (this.finished) {
      return [];
    }

    return _.flatten(this.availableMovesMatrix
      .map((xs, y) => xs
        .map((available, x) => [x, y, available])
        .filter(([, , available]) => available)
        .map(([x,y])=>({x,y}))));
  }

  getNextGames() {
    return this.getAvailableMoves().map(move => this.makeMove(move));
  }

  getNextFullMoveGames(nextPlayer = this.nextPlayer) {
    if (this.nextPlayer !== nextPlayer) {
      return [this];
    }

    return _.flatten(this.getNextGames().map(game => game.getNextFullMoveGames(nextPlayer)));
  }

  getSearchState(maxDepth, previous = null) {
    const result = this.finished ? (this.winner === this.nextPlayer ? 'won' : 'lost') : null;
    return {
      game: this,
      result: result,
      nextGamesLeft: this.getNextFullMoveGames(),
      results: {
        won: result === 'won',
        lost: result === 'lost',
        undetermined: false,
      },
      ...(!previous || previous.loseLeaves ? {
        winLeaves: result ==='won' ? [this] : [],
      } : {
        loseLeaves: result === 'lost' ? [this] : [],
      }),
      previous,
      moves: null,
      maxDepth,
    };
  }

  static advanceSearchState(state) {
    if (state.result !== null) {
      console.log('got result', state.result, 'with', state.maxDepth, 'depth');
      if (state.previous) {
        if (state.result === 'won') {
          state.previous.results.lost = true;
          if (state.winLeaves) {
            state.previous.loseLeaves.push(...state.winLeaves);
          }
        } else if (state.result === 'lost') {
          state.previous.results.won = true;
          // state.previous.result = 'won';
          if (state.loseLeaves) {
            state.previous.winLeaves.push(...state.loseLeaves);
          }
        } else {
          throw new Error(`Unknown result '${state.result}'`);
        }
        return state.previous;
      } else {
        return state;
      }
    }
    if (state.maxDepth <= 0) {
      // console.log('undetermined');
      state.results.undetermined = true;
      if (state.previous) {
        state.previous.results.undetermined = true;
        return state.previous;
      } else {
        console.log('finished');
        return state;
      }
    }
    if (!state.nextGamesLeft.length) {
      if (state.results.won) {
        state.result = 'won';
        return state;
      } else if (state.results.undetermined) {
        if (state.previous) {
          state.previous.results.undetermined = true;
          return state.previous;
        } else {
          console.log('finished');
          return state;
        }
      } else if (state.results.lost) {
        state.result = 'lost';
        return state;
      }
      console.log(state);
      throw new Error('Result is null, there are no next games, and there are no results');
    }
    const nextGame = state.nextGamesLeft.shift();
    return nextGame.getSearchState(state.maxDepth - 1, state);
  }

  static advanceSearchStateSteps(state, steps = 20) {
    let rootState = state;
    while (rootState.previous) {
      rootState = rootState.previous;
    }
    for (let i = 0 ; i < steps ; i++) {
      if (rootState.result !== null ) {
        break;
      }
      state = this.advanceSearchState(state);
    }

    return state;
  }
}

class GameClassic extends Game {
  static areCellsNeighbours(lhs, rhs) {
    return (
      Math.abs(lhs.x - rhs.x) <= 1
      && Math.abs(lhs.y - rhs.y) <= 1
    );
  }

  static transformationMaxRotations = 4;

  // noinspection JSSuspiciousNameCombination
  static transformationMap = {
    '0,false': null,
    '1,false': this.makeTransformRowsAndColumns({transpose: true, flipX: false, flipY: true}),
    '2,false': this.makeTransformRowsAndColumns({transpose: false, flipX: true, flipY: true}),
    '3,false': this.makeTransformRowsAndColumns({transpose: true, flipX: true, flipY: false}),
    '0,true': this.makeTransformRowsAndColumns({transpose: false, flipX: true, flipY: false}),
    '1,true': this.makeTransformRowsAndColumns({transpose: true, flipX: true, flipY: true}),
    '2,true': this.makeTransformRowsAndColumns({transpose: false, flipX: false, flipY: true}),
    '3,true': this.makeTransformRowsAndColumns({transpose: true, flipX: false, flipY: false}),
  };
  static noTransformation = this.makeTransformRowsAndColumns({transpose:  false, flipX: false, flipY: false});

  static makeTransformRowsAndColumns(config) {
    const transformRowsAndColumns = rowsAndColumns => {
      return this.transformRowsAndColumns(rowsAndColumns, config);
    };
    transformRowsAndColumns.coordinates = (rowsAndColumns, coordinates) => {
      return this.reverseTransformCoordinates(rowsAndColumns, coordinates, config);
    };
    // We can tell if the board is flipped (horizontally or vertically)
    const flipped = config.transpose ^ config.flipX ^ config.flipY;
    const reverseConfig = config.transpose && !flipped ? {
      transpose: config.transpose,
      flipX: !config.flipX,
      flipY: !config.flipY,
    } : config;
    transformRowsAndColumns.reverseCoordinates = (rowsAndColumns, coordinates) => {
      return this.reverseTransformCoordinates(rowsAndColumns, coordinates, reverseConfig);
    };

    return transformRowsAndColumns;
  }

  static transformRowsAndColumns(rowsAndColumns, config) {
    let {newRowCount, newColumnCount} = this.getTransformationNewRowAndColumnCount(rowsAndColumns, config);
    const newXs = _.range(newColumnCount);
    const newYs = _.range(newRowCount);

    return newYs.map(newY => ({
      y: newY,
      cells: newXs.map(newX => {
        let {oldX, oldY} = this.getTransformationOldCoordinates( {newX, newY}, {newRowCount, newColumnCount}, config);
        return {
        ...rowsAndColumns[oldY].cells[oldX],
          x: newX, y: newY,
        };
      }),
    }));
  }

  static reverseTransformCoordinates(rowsAndColumns, coordinates, config) {
    let {newRowCount, newColumnCount} = this.getTransformationNewRowAndColumnCount(rowsAndColumns, config);
    const {x: newX, y: newY} = coordinates;
    const {oldX, oldY} = this.getTransformationOldCoordinates( {newX, newY}, {newRowCount, newColumnCount}, config);

    return {x: oldX, y: oldY};
  }

  static getTransformationNewRowAndColumnCount(rowsAndColumns, config) {
    const rowCount = rowsAndColumns.length;
    const columnCount = Math.max(...rowsAndColumns.map(row => row.cells.length)) || 0;
    const {transpose} = config;
    let newRowCount, newColumnCount;
    if (transpose) {
      [newColumnCount, newRowCount] = [rowCount, columnCount];
    } else {
      [newColumnCount, newRowCount] = [columnCount, rowCount];
    }
    return {newRowCount, newColumnCount};
  }

  static getTransformationOldCoordinates({newX, newY}, {newColumnCount, newRowCount}, config) {
    const {transpose, flipX, flipY} = config;
    let oldX, oldY;
    if (transpose) {
      [oldX, oldY] = [newY, newX];
    } else {
      [oldX, oldY] = [newX, newY];
    }
    if (flipX) {
      oldX = newColumnCount - 1 - oldX;
    }
    if (flipY) {
      oldY = newRowCount - 1 - oldY;
    }
    return {oldX, oldY};
  }

  getSucceedingEquivalentPositionNotationAndMoves(nextGame) {
    const allPositionNotations = nextGame.allPositionNotations;
    for (const position of allPositionNotations) {
      const game = this.constructor.fromCompressedPositionNotation(position);
      const {moves} = this.inferMoves(game);
      if (moves) {
        return {position, moves};
      }
    }
    return {position: null, moves: null};
  }

  inferMoves(nextGame) {
    const previousRowsAndColumns = this.rowsAndColumns;
    const rowsAndColumns = nextGame.rowsAndColumns;
    let fromCoordinates = null, toCoordinates = null, isPlaceWorkersMove = false;
    let buildCoordinates = null, canBeMissingBuildMove = true;
    for (const y of this.constructor.ROWS) {
      for (const x of this.constructor.COLUMNS) {
        const previousCell = previousRowsAndColumns[y].cells[x];
        const cell = rowsAndColumns[y].cells[x];

        if (previousCell.player !== cell.player) {
          if (previousCell.player && cell.player) {
            return {moves: null, error: ['Both cells had different players', previousCell, cell]};
          } else if (previousCell.player) {
            if (fromCoordinates) {
              return {moves: null, error: ['There was a from coordinates', previousCell, fromCoordinates]};
            }
            fromCoordinates = {x, y};
          } else if (cell.player) {
            if (toCoordinates) {
              if (canBeMissingBuildMove) {
                if (isPlaceWorkersMove) {
                  return {moves: null, error: ['Trying to place too many workers', cell, fromCoordinates, toCoordinates]};
                }
                isPlaceWorkersMove = true;
                fromCoordinates = toCoordinates;
              } else {
                return {moves: null, error: ['There was a to coordinates', cell, toCoordinates]};
              }
            }
            toCoordinates = {x, y};
          } else {
            return {moves: null, error: ['Both cells had different false players', previousCell, cell]};
          }
        }

        if (previousCell.level > 0 || cell.level > 0) {
          if (isPlaceWorkersMove) {
            return {moves: null, error: ['There are levels, while placing initial workers', previousCell, cell, fromCoordinates, toCoordinates]};
          }
          canBeMissingBuildMove = false;
        }
        if (previousCell.level !== cell.level) {
          if (buildCoordinates) {
            return {moves: null, error: ['There was a build coordinates', previousCell, cell, buildCoordinates]};
          }
          if (previousCell.level !== (cell.level - 1)) {
            return {moves: null, error: ['The build was too high or too low', previousCell, cell]};
          }
          buildCoordinates = {x, y};
        }
      }
    }
    if (!fromCoordinates || !toCoordinates) {
      return {moves: null, error: ['There was either no from or no to coordinates', fromCoordinates, toCoordinates]};
    }
    if (!canBeMissingBuildMove && !buildCoordinates) {
      return {moves: null, error: ['It couldn\'t be missing build move but it did', canBeMissingBuildMove, buildCoordinates]};
    }
    let moves;
    if (canBeMissingBuildMove) {
      moves = [fromCoordinates, toCoordinates];
    } else {
      moves = [fromCoordinates, toCoordinates, buildCoordinates];
    }
    try {
      this.makeMoves(moves);
    } catch (e) {
      if (e instanceof InvalidMoveError) {
        return {moves: null, error: ['The moves were invalid', moves]};
      }
      throw e;
    }
    return {moves, error: null};
  }

  static fromJsonMoves(moves) {
    return this.create().applyJsonMoves(moves);
  }

  static convertJsonMovesToNotationsHistory(moves) {
    return this.fromJsonMoves(moves).currentAndNormalisedPositionNotationsHistory;
  }

  applyJsonMoves(moves) {
    let result = this;
    for (const move of moves) {
      result = result.applyJsonMove(move);
      if (result.finished) {
        break;
      }
    }
    return result;
  }

  applyJsonMove(move) {
    const {first_player: firstPlayer, type} = move;
    if (firstPlayer !== (this.nextPlayer === Game.PLAYER_A)) {
      throw new Error(`Expected to be ${firstPlayer ? "first's" : "second's"} player turn, but it wasn't`);
    }
    switch (type) {
      case "place-workers":
        return this
            .placeFirstWorker({x: move.first_target_x - 1, y: move.first_target_y - 1})
            .placeSecondWorker({x: move.second_target_x - 1, y: move.second_target_y - 1});
      case "move-and-build":
        if (!this.availableMovesMatrix[move.target_y - 1][move.target_x - 1]) {
          return this.resign(this.nextPlayer);
        }
        const cell = this.rowsAndColumns[move.source_y - 1].cells[move.source_x - 1];
        if (cell.player !== this.nextPlayer) {
          throw new Error(`Tried to move a piece from a cell where the player didn't have one`);
        }
        const afterMove = this.moveWorker({x: move.target_x - 1, y: move.target_y - 1}, cell.worker);
        if (afterMove.finished) {
          this.resign(this.nextPlayer);
        }
        if (!afterMove.availableMovesMatrix[move.build_y - 1][move.build_x - 1]) {
          return this.resign(this.nextPlayer);
        }
        return afterMove
            .buildAroundWorker({x: move.build_x - 1, y: move.build_y - 1});
      default:
        throw new Error(`Unknown move type: ${type}`);
    }
  }
}
Game.Classic = GameClassic;

class GameHex extends Game {
  static areCellsNeighbours(lhs, rhs) {
    if (!(
      Math.abs(lhs.x - rhs.x) <= 1
      && Math.abs(lhs.y - rhs.y) <= 1
    )) {
      return false;
    }

    if (lhs.x === rhs.x) {
      return true;
    } else if (lhs.x % 2 === 0) {
      return rhs.y >= lhs.y;
    } else {
      return rhs.y <= lhs.y;
    }
  }
}
Game.Hex = GameHex;

Game.GAME_TYPES = [Game.Classic, Game.Hex];

module.exports = {
  default: Game,
  Game,
  InvalidMoveError,
};
