const util = require('util');
const moment = require('moment');

const tasks = [];

const addTask = task => {
  if (!task.name) {
    throw new Error("Task didn't have a non-empty `name` attribute");
  }
  if (!task.interval && task.interval !== 0) {
    throw new Error("Task dint' have an `interval` attribute");
  }
  if (typeof task.interval !== typeof 0 || isNaN(task.interval)) {
    throw new Error("Task interval was not a number");
  }
  if (task.interval < 1000) {
    throw new Error("Task interval was too small");
  }
  if (typeof task.run !== typeof function(){}) {
    throw new Error("Task didn't have a callable `run` attribute")
  }
  tasks.push(task);
};

const runAllTasks = () => {
  for (const task of tasks) {
    process.stdout.write(util.formatWithOptions({colors: true}, 'Running task', task.name, 'on', moment().toISOString(), '... '));
    const start = process.hrtime();
    task.run();
    const [seconds, nanoseconds] = process.hrtime(start);
    console.log('in', (seconds + nanoseconds / 1e9).toFixed(1), 'seconds');
  }
};

const setUpIntervals = () => {
  stopTasks();
  for (const task of tasks) {
    if (task.interval) {
      task.intervalId = setInterval(task.run, task.interval);
    }
  }
};

const stopTasks = () => {
  for (const task of tasks) {
    if (task.intervalId) {
      clearInterval(task.intervalId);
    }
    task.intervalId = null;
  }
};

const every = {
  second: 1000,
  seconds: seconds => seconds * every.second,
  minute: 60 * 1000,
  minutes: minutes => minutes * every.minute,
  hour: 60 * 60 * 1000,
  hours: hours => hours * every.hour,
  day: 24 * 60 * 60 * 1000,
  days: days => days * every.day,
};

module.exports = {
  tasks, addTask, runAllTasks, setUpIntervals, stopTasks, every,
};

require('./tasks');
