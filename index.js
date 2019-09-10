Error.stackTraceLimit = Infinity;

require('./src/data');
const server = require('./src/server');
const tasks = require('./src/tasks');
const websocket = require('./src/websocket');

tasks.runAllTasks();
tasks.setUpIntervals();
websocket.listen();
server.serve();
