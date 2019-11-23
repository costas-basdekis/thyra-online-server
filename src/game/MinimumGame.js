const _ = require('lodash');
const moment = require('moment');
const deePool = require('deepool');
const utils = require('../utils');

class MinimumGame {
  static PLAYER_A = 'player-a';
  static PLAYER_B = 'player-b';

  static ROWS = _.range(5);
  static COLUMNS = _.range(5);

  static positionToIndex = this.ROWS.map(y => this.COLUMNS.map(x => y * this.COLUMNS.length + x));
  static indexToPosition = _.flatten(this.ROWS.map(y => this.COLUMNS.map(x => ({x, y}))));
  static indexes = this.indexToPosition.map((position, index) => index);
  static allBitmap = this.indexesToBitmap(this.indexes);
  static noneBitmap = this.indexesToBitmap([]);

  static neighboursOffsets =
    _.flatten(_.range(-1, 2).map(dY => _.range(-1, 2).map(dX => ({dX, dY}))))
      .filter(({dX, dY}) => dX || dY);

  static neighboursIndexes = this.indexes
    .map(index => this.getNeighboursIndexes(index));
  static neighboursBitmap = this.neighboursIndexes
    .map(indexes => this.indexesToBitmap(indexes));

  static getNeighboursIndexes(index) {
    const position = this.indexToPosition[index];
    return this.getNeighboursCoordinates(position)
      .map(neighbour => this.positionToIndex[neighbour.y][neighbour.x]);
  }

  static getNeighboursCoordinates(position) {
    return this.neighboursOffsets
      .map(({dX, dY}) => ({x: position.x + dX, y: position.y + dY}))
      .filter(neighbour => this.ROWS.includes(neighbour.y) && this.COLUMNS.includes(neighbour.x))
      .filter(neighbour => this.areCellsNeighbours(position, neighbour));
  }

  static areCellsNeighbours(lhs, rhs) {
    return (
      Math.abs(lhs.x - rhs.x) <= 1
      && Math.abs(lhs.y - rhs.y) <= 1
    );
  }

  static fromPosition(position) {
    const Game = require('./game').default;
    const fullGame = Game.Classic.fromCompressedPositionNotation(position);
    return this.fromFullGame(fullGame);
  }

  static fromFullGame(fullGame) {
    return this.fromRowsAndColumns(
      fullGame.rowsAndColumns, fullGame.nextPlayer === fullGame.constructor.PLAYER_A);
  }

  static fromRowsAndColumns(rowsAndColumns, whiteToPlay) {
    const levels = _.flatten(rowsAndColumns.map(row => row.cells.map(cell => cell.level)));
    const players = _.flatten(rowsAndColumns.map(row => row.cells.map(cell => cell.player)));
    const nextPlayerIndexes = players
      .map((player, index) => [player, index])
      .filter(([player]) => player === (whiteToPlay ? this.PLAYER_A : this.PLAYER_B))
      .map(([, index]) => index);
    const otherPlayerIndexes = players
      .map((player, index) => [player, index])
      .filter(([player]) => player === (whiteToPlay ? this.PLAYER_B : this.PLAYER_A))
      .map(([, index]) => index);

    return this.createNew(
      levels,
      this.indexesToBitmap(this.indexes.filter(index => levels[index] <= 1)),
      this.indexesToBitmap(this.indexes.filter(index => levels[index] === 2)),
      this.indexesToBitmap(this.indexes.filter(index => levels[index] === 3)),
      this.indexesToBitmap(this.indexes.filter(index => levels[index] === 4)),
      nextPlayerIndexes, otherPlayerIndexes, whiteToPlay, null, null,
    );
  }

  toPosition() {
    return this.toFullGame().positionNotation;
  }

  toFullGame() {
    const Game = require('./game').default;
    return Game.Classic.fromRowsAndColumns(this.toRowsAndColumns());
  }

  toRowsAndColumns() {
    const Game = require('./game').default;
    const rowsAndColumns = Game.Classic.getInitialRowsAndColumns();
    for (const index of this.constructor.indexes) {
      const {x, y} = this.constructor.indexToPosition[index];
      rowsAndColumns[y].cells[x].level = this.levels[index];
    }
    for (const [playerIndexes, player] of [[this.nextPlayerIndexes, this.whiteToPlay ? Game.PLAYER_A : Game.PLAYER_B], [this.otherPlayerIndexes, this.whiteToPlay ? Game.PLAYER_B : Game.PLAYER_A]]) {
      if (playerIndexes.length) {
        const [firstWorkerIndex, secondWorkerIndex] = playerIndexes;
        for (const [workerIndex, worker] of [[firstWorkerIndex, Game.WORKER_FIRST], [secondWorkerIndex, Game.WORKER_SECOND]]) {
          const workerPosition = this.constructor.indexToPosition[workerIndex];
          rowsAndColumns[workerPosition.y].cells[workerPosition.x].player = player;
          rowsAndColumns[workerPosition.y].cells[workerPosition.x].worker = worker;
        }
      }
    }
    return rowsAndColumns;
  }

  static solvePosition({position, maxDepth, usePool = false} = {}) {
    const game = this.fromPosition(position);
    if (usePool) {
      game.usePool();
    }
    const search = game.search(maxDepth, usePool);
    search.advanceSteps();

    return search;
  };

  constructor() {
    this.levels = undefined;
    this.level01 = undefined;
    this.level2 = undefined;
    this.level3 = undefined;
    this.level4 = undefined;
    this.nextPlayerIndexes = undefined;
    this.otherPlayerIndexes = undefined;
    this.whiteToPlay = undefined;
    this.previous = undefined;
    this.moves = undefined;
    this.depth = undefined;
    this.makeNext = undefined;
    this._lostData = undefined;
    this._nextMoves = undefined;
    this._nextGames = undefined;
    this._winner = undefined;
    this._history = undefined;
    this._hash = undefined;
  }

  fromArgs(levels, level01, level2, level3, level4, nextPlayerIndexes, otherPlayerIndexes, whiteToPlay, previous, moves, pool = null) {
    this.levels = levels;
    this.level01 = level01;
    this.level2 = level2;
    this.level3 = level3;
    this.level4 = level4;
    this.nextPlayerIndexes = nextPlayerIndexes;
    this.otherPlayerIndexes = otherPlayerIndexes;
    this.whiteToPlay = whiteToPlay;
    this.previous = previous;
    this.moves = moves;
    this.depth = previous ? previous.depth + 1 : 0;
    this.makeNext = pool === true ? this.constructor.createFromPool : (pool ? pool : this.constructor.createNew);
    this._lostData = undefined;
    this._nextMoves = undefined;
    this._nextGames = undefined;
    this._winner = undefined;
    this._history = undefined;
    this._hash = undefined;
  }

  usePool() {
    this.makeNext = this.constructor.createFromPool;
    return this;
  }

  recycle() {
    if (this.makeNext === this.constructor.createFromPool) {
      this.constructor.pool.recycle(this);
    }
  }

  static pool = (() => {
    const pool = deePool.create(() => new MinimumGame());
    // pool.grow(1000);
    return pool;
  })();

  static createFromPool(...args) {
    const item = MinimumGame.pool.use();
    item.fromArgs(...args);
    return item;
  }

  static createNew(...args) {
    const item = new MinimumGame(...args);
    item.fromArgs(...args);
    return item;
  }

  copy() {
    const {levels, level01, level2, level3, level4, nextPlayerIndexes, otherPlayerIndexes, whiteToPlay, previous, moves, pool} = this;
    return this.constructor.createNew(
      levels, level01, level2, level3, level4, nextPlayerIndexes, otherPlayerIndexes, whiteToPlay, previous ? previous.copy() : null,
      moves, pool);
  }

  get hash() {
    if (this._hash === undefined) {
      const {levels, nextPlayerIndexes, otherPlayerIndexes} = this;
      this._hash = `${levels.join('')},${this.constructor.indexesToBitmap(nextPlayerIndexes)},${this.constructor.indexesToBitmap(otherPlayerIndexes)}`;
    }

    return this._hash;
  }

  get fullMoves() {
    if (!this.moves) {
      return null;
    }
    return this.moves.map(index => this.constructor.indexToPosition[index]);
  }

  get historyFullMoves() {
    return this.history.slice(1).map(game => game.fullMoves);
  }

  get lostData() {
    if (this._lostData === undefined) {
      const {levels, otherPlayerIndexes, level2, level3} = this;
      const {neighboursBitmap, noneBitmap} = this.constructor;
      let mustBlockBitmap = noneBitmap, cannotBuildBitmap = noneBitmap;
      for (const workerIndex of otherPlayerIndexes) {
        if (levels[workerIndex] !== 2) {
          continue;
        }
        cannotBuildBitmap |= neighboursBitmap[workerIndex] & level2;
        mustBlockBitmap |= neighboursBitmap[workerIndex] & level3;
      }
      const mustBlockIndexes = this.constructor.bitmapToIndexes(mustBlockBitmap);
      const lost = mustBlockIndexes.length > 1;
      const mustBlockIndex = mustBlockIndexes.length ? mustBlockIndexes[0] : null;

      this._lostData = [mustBlockIndex, cannotBuildBitmap, lost];
    }

    return this._lostData;
  }

  get lost() {
    if (this._nextMoves === undefined) {
      const {nextPlayerIndexes} = this;
      if (!nextPlayerIndexes.length) {
        return false;
      }
      const [, , lost] = this.lostData;
      if (lost) {
        return true;
      }
    }

    return !this.nextMoves.length;
  }

  get nextMoves() {
    if (this._nextMoves === undefined) {
      const {allBitmap} = this.constructor;
      const {nextPlayerIndexes, otherPlayerIndexes} = this;
      const playersBitmap = (
        this.constructor.indexesToBitmap(nextPlayerIndexes)
        | this.constructor.indexesToBitmap(otherPlayerIndexes)
      );
      if (!nextPlayerIndexes.length) {
        const nextMoves = [];
        const firstWorkerBitmap = allBitmap & ~playersBitmap;
        for (const firstWorkerIndex of this.constructor.bitmapToIndexes(firstWorkerBitmap)) {
          const secondWorkerBitmap = allBitmap & ~playersBitmap & ~(1 << firstWorkerIndex);
          for (const secondWorkerIndex of this.constructor.bitmapToIndexes(secondWorkerBitmap)) {
            nextMoves.push([firstWorkerIndex, secondWorkerIndex]);
          }
        }
        this._nextMoves = nextMoves;
      } else {
        const {levels, level01, level2, level3, level4, nextPlayerIndexes} = this;
        const {neighboursBitmap} = this.constructor;
        const [mustBlockIndex, cannotBuildBitmap, lost] = this.lostData;
        if (lost) {
          this._nextMoves = [];
        } else {
          const mustBlockBitmap = mustBlockIndex !== null
            ? (1 << mustBlockIndex)
            : allBitmap;
          const mustBlockNeighbourBitmap = mustBlockIndex !== null
            ? neighboursBitmap[mustBlockIndex]
            : allBitmap;
          const canMoveToBitmap = (
            allBitmap
            & ~playersBitmap
            & mustBlockNeighbourBitmap
          );
          const canBuildToBitmap = (
            allBitmap
            & mustBlockBitmap
            & ~cannotBuildBitmap
            & ~level4
          );
          const nextMoves = [];
          for (const selectedWorkerIndex of nextPlayerIndexes) {
            const selectedWorkerLevel = levels[selectedWorkerIndex];
            let maxNeighbourLevelBitmap = level01;
            if (selectedWorkerLevel >= 1) {
              maxNeighbourLevelBitmap |= level2;
              if (selectedWorkerLevel >= 2) {
                maxNeighbourLevelBitmap |= level3;
              }
            }
            const moveToIndexes = this.constructor
              .bitmapToIndexes(
                canMoveToBitmap
                & neighboursBitmap[selectedWorkerIndex]
                & maxNeighbourLevelBitmap
              );
            for (const moveToIndex of moveToIndexes) {
              const buildToIndexes = this.constructor
                .bitmapToIndexes(
                  canBuildToBitmap
                  & ~(playersBitmap & ~(1 << selectedWorkerIndex))
                  & neighboursBitmap[moveToIndex]
                );
              for (const buildToIndex of buildToIndexes) {
                nextMoves.push([selectedWorkerIndex, moveToIndex, buildToIndex]);
              }
            }
          }
          this._nextMoves = nextMoves;
        }
      }
    }

    return this._nextMoves;
  }

  get nextGames() {
    if (this._nextGames === undefined) {
      if (!this.nextPlayerIndexes.length) {
        const {levels, level01, level2, level3, level4, otherPlayerIndexes, whiteToPlay, pool} = this;
        this._nextGames = this.nextMoves.map(workersIndexes => this.makeNext(
          levels,
          level01,
          level2,
          level3,
          level4,
          otherPlayerIndexes,
          workersIndexes,
          !whiteToPlay,
          this,
          workersIndexes,
          pool,
        ));
      } else {
        const {buildOnLevel, moveWorker} = this.constructor;
        const {levels, otherPlayerIndexes, nextPlayerIndexes, whiteToPlay, pool} = this;
        this._nextGames = this.nextMoves.map(moves => {
          const [selectedWorkerIndex, moveToIndex, buildToIndex] =  moves;
          let {level01, level2, level3, level4} = this;
          const buildToLevel = levels[buildToIndex];
          if (buildToLevel === 1) {
            level01 &= ~(1 << buildToIndex);
            level2 |= 1 << buildToIndex;
          } else if (buildToLevel === 2) {
            level2 &= ~(1 << buildToIndex);
            level3 |= 1 << buildToIndex;
          } else if (buildToLevel === 3) {
            level3 &= ~(1 << buildToIndex);
            level4 |= 1 << buildToIndex;
          }
          return this.makeNext(
            buildOnLevel(levels, buildToIndex),
            level01,
            level2,
            level3,
            level4,
            otherPlayerIndexes,
            moveWorker(nextPlayerIndexes, selectedWorkerIndex, moveToIndex),
            !whiteToPlay,
            this,
            moves,
            pool,
          );
        });
      }
    }

    return this._nextGames;
  }

  static buildOnLevel(levels, buildToIndex) {
    const newLevels = levels.slice();
    newLevels[buildToIndex] += 1;

    return newLevels;
  }

  static moveWorker(playerIndexes, selectedWorkerIndex, moveToIndex) {
    const indexInList = playerIndexes.indexOf(selectedWorkerIndex);
    const newPlayerIndexes = playerIndexes.slice();
    newPlayerIndexes[indexInList] = moveToIndex;

    return newPlayerIndexes;
  }

  static indexesToBitmap(indexes) {
    let bitmap = 0;
    for (const index of indexes) {
      bitmap |= 1 << index;
    }

    return bitmap;
  }

  static bitmapToIndexes(bitmap) {
    if (!bitmap) {
      return [];
    }

    let remaining = bitmap;
    const indexes = [];

    const log2 = Math.log(2);
    while (remaining) {
      const index = Math.floor(Math.log(remaining) / log2);
      indexes.push(index);
      remaining -= 1 << index;
    }

    indexes.reverse();

    return indexes;
  }

  get winner() {
    if (this._winner === undefined) {
      if (!this.nextPlayerIndexes.length) {
        this._winner = null;
      } else {
        if (!this.nextMoves.length) {
          this._winner = this.whiteToPlay ? this.constructor.PLAYER_B : this.constructor.PLAYER_A;
        } else {
          this._winner = null;
        }
      }
    }

    return this._winner;
  }

  get finished() {
    return !!this.winner;
  }

  get history() {
    if (this._history === undefined) {
      const history = [];
      let game = this;
      while (game) {
        history.push(game);
        game = game.previous;
      }
      history.reverse();
      this._history = history;
    }

    return this._history;
  }

  search(maxDepth, pool = false) {
    return new MinimumGameSearch(this, maxDepth, pool);
  }
}

class MinimumGameSearch {
  constructor(game, maxDepth, pool = null, maxCacheDepth = Infinity, maxCacheSize = 10 * 1000 * 1000, maxCacheRelativeDepth = 4) {
    this.totalGameCount = 0;
    this.totalTime = 0;
    this.maxDepth = maxDepth;
    this.maxCacheDepth = maxCacheDepth;
    this.maxCacheSize = maxCacheSize;
    this.maxCacheRelativeDepth = maxCacheRelativeDepth;
    this.hashMapsByDepth = _.range(maxDepth + 1).map(() => new Map());
    this.uniqueHashesByDepth = _.range(maxDepth + 1).map(() => 0);
    this.repeatedHashesByDepth = _.range(maxDepth + 1).map(() => 0);

    this.root = MinimumGameSearchStep.createNew(this, game, maxDepth, null, pool);
    this.step = this.root;
  }

  getCachedStep(game) {
    const depth = game.depth;
    if (depth > this.maxCacheDepth) {
      return null;
    }
    const cachedResult = this.hashMapsByDepth[depth].get(game.hash) || null;
    if (cachedResult !== null) {
      this.repeatedHashesByDepth[depth] += 1;
    } else {
      this.uniqueHashesByDepth[depth] += 1;
    }

    return cachedResult
  }

  cacheStep(step) {
    if (step.game.depth > this.maxCacheDepth) {
      return;
    }
    if (step.result === step.track) {
      return;
    }
    let hashMap = this.hashMapsByDepth[step.game.depth];
    if (hashMap.size > this.maxCacheSize) {
      hashMap = this.hashMapsByDepth[step.game.depth] = new Map();
    }
    this.clearCacheAtDepth(step.game.depth + this.maxCacheRelativeDepth);
    hashMap.set(step.game.hash, step.result);
  }

  clearCacheAtDepth(depth) {
    if (depth > this.maxCacheDepth) {
      return;
    }
    this.hashMapsByDepth[depth] = new Map();
  }

  get finished() {
    return !!this.root.result;
  }

  get completionRatio() {
    return this.step.completionRatio;
  }

  advance() {
    if (this.finished) {
      return false;
    }
    this.step = this.step.advance();
    return true;
  }

  advanceSteps(stepCount = Infinity) {
    const timer = this.createTimer(stepCount);
    for (let i = 0 ; i < stepCount ; i++) {
      const stop = !this.advance();
      timer.report(i);
      if (stop) {
        break;
      }
    }
    this.totalTime += timer.getTotalTime();
  }

  createTimer(totalStepCount = Infinity, reportStepCount = Math.min(totalStepCount / 1000, 2500000)) {
    const startTime = moment();
    const timer = {
      startTime,
      lastTime: startTime,
      lastGameCount: this.totalGameCount,
      reportStepCount, totalStepCount,
      report: counter => {
        if (!(counter % reportStepCount === 0 || this.finished)) {
          return;
        }
        const root = this.root;
        const now = moment();
        const sinceLastTime = now.diff(timer.lastTime);
        const gameCountSinceLastTime = this.totalGameCount - timer.lastGameCount;
        const totalTime = now.diff(timer.startTime) + this.totalTime;
        timer.lastTime = now;
        timer.lastGameCount = this.totalGameCount;
        const completionRatio = this.completionRatio;
        const totalGamesPerSecond = Math.round(this.totalGameCount / totalTime * 1000);
        const currentGamesPerSecond = Math.round(gameCountSinceLastTime / sinceLastTime * 1000);
        const estimatedGameCount = this.totalGameCount / completionRatio;
        const gameLeftCount = estimatedGameCount * (1 - completionRatio);
        const totalTimeLeftEstimation = gameLeftCount / totalGamesPerSecond * 1000;
        const currentTimeLeftEstimation = gameLeftCount / currentGamesPerSecond * 1000;
        const totalHashesByDepth = _.range(this.maxDepth + 1).map(depth => this.uniqueHashesByDepth[depth] + this.repeatedHashesByDepth[depth]);
        const repeatedHashes = _.sum(this.repeatedHashesByDepth);
        const totalHashes = _.sum(totalHashesByDepth);
        const memoryUsage = process.memoryUsage();
        const totalRepeatedRatio = _.range(this.maxDepth + 1)
          .map(depth => totalHashesByDepth[depth]
            ? this.repeatedHashesByDepth[depth] / totalHashesByDepth[depth]
            : 0)
          .reverse()
          .reduce((total, current) => current + (1 - current) * total);
        console.log(
          ` ---\n`,
          `${totalStepCount !== Infinity ? `${Math.round(counter / totalStepCount * 1000) / 10}% of steps, ` : ''}${Math.round(completionRatio * 100 * 1000) / 1000}% of games (est. ${utils.abbreviateNumber(estimatedGameCount)}/${utils.abbreviateNumber(Math.pow(33, this.maxDepth))}), pool sizes: ${MinimumGame.pool.size()} games, ${MinimumGameSearchStep.pool.size()} steps\n`,
          `Hashes:\n`,
          totalHashes ? `  ${`Created:   ${utils.abbreviateNumber(totalHashes)}`.padEnd(20, ' ')} ${_.range(this.maxDepth + 1).map(depth => `${depth}: ${Math.round(totalHashesByDepth[depth] / totalHashes * 100)}%`).map(text => text.padEnd(9, ' ')).join(', ')}\n` : '',
          totalHashes ? `  ${`In memory: ${utils.abbreviateNumber(_.sumBy(this.hashMapsByDepth, 'size'))}`.padEnd(20, ' ')} ${_.range(this.maxDepth + 1).map(depth => `${depth}: ${utils.abbreviateNumber(this.hashMapsByDepth[depth].size)}`).map(text => text.padEnd(9, ' ')).join(', ')}\n` : '',
          totalHashes ? `  ${`Repeated:  ${Math.round(totalRepeatedRatio * 100)}%`.padEnd(20, ' ')} ${_.range(this.maxDepth + 1).map(depth => `${depth}: ${totalHashesByDepth[depth] ? Math.round(this.repeatedHashesByDepth[depth] / totalHashesByDepth[depth] * 100) : 0}%`).map(text => text.padEnd(9, ' ')).join(', ')}\n` : '',
          `Memory usage: RSS: ${utils.abbreviateNumber(memoryUsage.rss)}, Heap total: ${utils.abbreviateNumber(memoryUsage.heapTotal)}, Heap used: ${utils.abbreviateNumber(memoryUsage.heapUsed)}, External: ${utils.abbreviateNumber(memoryUsage.external)}\n`,
          root.leaves ? `${root.leaves.length} solutions found, of depth ${root.leaves[0].depth}\n` : `no solutions\n`,
          `total ${utils.abbreviateNumber(this.totalGameCount)} games created, in ${moment.duration(totalTime).humanize()}, ${utils.abbreviateNumber(totalGamesPerSecond)}g/s, ${moment.duration(totalTimeLeftEstimation).humanize()} left\n`,
          `current ${utils.abbreviateNumber(gameCountSinceLastTime)} games created, in ${moment.duration(sinceLastTime).humanize()}, ${utils.abbreviateNumber(currentGamesPerSecond)}g/s, ${moment.duration(currentTimeLeftEstimation).humanize()} left`,
        );
      },
      getTotalTime: () => {
        return moment().diff(startTime);
      },
    };

    return timer;
  }

  get dictPositions() {
    return this.constructor.toDictPositions((this.root.leaves || []).map(game => game.history));
  }

  static toDictPositions(list) {
    return _.mapValues(
      _.groupBy(list,history => history[0].toPosition()),
      nextList => ({
          moves: nextList.length ? nextList[0][0].fullMoves : null,
          next: this.toDictPositions(nextList
            .map(history => history.slice(1))
            .filter(history => history.length))
        }),
      );
  }
}

class MinimumGameSearchStep {
  static WIN = 'win';
  static LOSE = 'lose';
  static UNDETERMINED = 'undetermined';

  constructor() {
    this.game = undefined;
    this.result = undefined;
    this.nextGamesCount = undefined;
    this.nextGamesLeft = undefined;
    this.resultsWon = undefined;
    this.resultsLost = undefined;
    this.resultsUndetermined = undefined;
    this.track = undefined;
    this.leaves = undefined;
    this.previous = undefined;
    this.maxDepth = undefined;
    this.search = undefined;

    this.makeNext = undefined;
  }

  fromArgs(search, game, maxDepth, previous = null, pool = null) {
    const {WIN, LOSE, UNDETERMINED} = this.constructor;
    const cachedResult = search.getCachedStep(game);
    const result = cachedResult !== null
      ? cachedResult
      : (
        maxDepth > 0
          ? (
            game.finished
              ? LOSE
              : null
          )
          : (
            game.lost
              ? LOSE
              : UNDETERMINED
          )
    );
    const nextGames = result === null ? game.nextGames : [];
    game._nextMoves = undefined;
    game._nextGames = undefined;
    game._winner = undefined;
    this.game = game;
    this.result = result;
    this.nextGamesCount = nextGames.length;
    this.nextGamesLeft = nextGames;
    this.resultsWon = result === WIN;
    this.resultsLost = result === LOSE;
    this.resultsUndetermined = result === UNDETERMINED;
    this.track = !previous || previous.track === LOSE
      ? WIN
      : LOSE;
    this.leaves = cachedResult !== null
      ? null
      : (
        this.track === result
          ? [game.copy()]
          : null
      );
    this.previous = previous;
    this.maxDepth = maxDepth;

    this.search = search;
    this.search.totalGameCount += 1;

    this.makeNext = pool === true ? this.constructor.createFromPool : (pool ? pool : this.constructor.createNew);
  }

  usePool() {
    this.makeNext = this.constructor.createFromPool;
    return this;
  }

  recycle() {
    if (this.makeNext === this.constructor.createFromPool) {
      this.constructor.pool.recycle(this);
    }
  }

  static pool = (() => {
    const pool = deePool.create(() => new MinimumGameSearchStep());
    // pool.grow(1000);
    return pool;
  })();

  static createFromPool(...args) {
    const item = MinimumGameSearchStep.pool.use();
    item.fromArgs(...args);
    return item;
  }

  static createNew(...args) {
    const item = new MinimumGameSearchStep(...args);
    item.fromArgs(...args);
    return item;
  }

  get completionRatio() {
    return this.getCompletionRatio();
  }

  getCompletionRatio(nextRatio = null) {
    let completedCount = this.nextGamesCount - this.nextGamesLeft.length;
    if (nextRatio !== null) {
      completedCount += nextRatio - 1;
    }
    let thisRatio;
    if (this.nextGamesCount === 0) {
      thisRatio = 1;
    } else {
      thisRatio = completedCount / this.nextGamesCount;
    }
    if (!this.previous) {
      return thisRatio;
    }

    return this.previous.getCompletionRatio(thisRatio);
  }

  advance() {
    if (this.result === null) {
      if (!this.nextGamesLeft.length) {
        if (this.resultsWon) {
          this.result = this.constructor.WIN;
        } else if (this.resultsUndetermined) {
          this.result = this.constructor.UNDETERMINED;
        } else if (this.resultsLost) {
          this.result = this.constructor.LOSE;
        } else {
          console.error('Null result', this);
          throw new Error('Result is null, there are no next games, and there are no results');
        }
      } else if (this.track === this.constructor.LOSE) {
        if (this.resultsWon) {
          // Pruning
          this.result = this.constructor.WIN;
        } else if (this.resultsUndetermined) {
          // Pruning
          this.result = this.constructor.UNDETERMINED;
        }
      }
    }
    if (this.result !== null) {
      this.propagateResult();
      this.search.cacheStep(this);
      if (!this.previous) {
        console.log('finished');
        return this;
      }
      this.game.recycle();
      this.recycle();
      return this.previous;
    }

    const nextGame = this.nextGamesLeft.shift();
    return this.makeNext(this.search, nextGame, this.maxDepth - 1, this, this.makeNext);
  }

  propagateResult() {
    if (!this.previous) {
      return;
    }

    if (this.result === this.constructor.WIN) {
      this.previous.nextWon(this);
    } else if (this.result === this.constructor.UNDETERMINED) {
      this.previous.nextUndetermined();
    } else if (this.result === this.constructor.LOSE) {
      this.previous.nextLost(this);
    } else {
      throw new Error(`Unknown result '${this.result}'`);
    }
  }

  nextWon(next) {
    this.resultsLost = true;
    if (this.track !== this.constructor.LOSE) {
      return;
    }
    if (!next.leaves) {
      return;
    }

    if (!this.leaves) {
      this.leaves = next.leaves;
      return;
    }

    const existingDepth = this.leaves[0].depth;
    const newDepth = next.leaves[0].depth;
    if (newDepth < existingDepth) {
      return;
    }

    const existingLength = this.leaves.length;
    const newLength = next.leaves.length;
    if (newDepth === existingDepth && existingLength <= newLength) {
      return;
    }

    this.leaves = next.leaves;
  }

  nextLost(next) {
    this.resultsWon = true;
    if (this.track !== this.constructor.WIN) {
      return;
    }
    if (!next.leaves) {
      return;
    }

    if (!this.leaves) {
      this.leaves = next.leaves;
      return;
    }

    const existingDepth = this.leaves[0].depth;
    const newDepth = next.leaves[0].depth;
    if (newDepth > existingDepth) {
      return;
    }

    if (newDepth === existingDepth) {
      this.leaves.push(...next.leaves);
    } else {
      this.leaves = next.leaves;
    }
  }

  nextUndetermined() {
    this.resultsUndetermined = true;
  }
}

module.exports = {
  MinimumGame, MinimumGameSearch,
};
