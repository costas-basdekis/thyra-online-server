const app = require('./app');
const {server, serve} = require('./serve');
require('./views');

module.exports = {
  app, server, serve,
};
