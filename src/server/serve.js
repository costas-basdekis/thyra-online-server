const app = require('./app');
const http = require('http');
const server = http.createServer(app);

const serve = () => {
  server.listen(4000, function () {
    console.log('listening on *:4000');
  });
};

module.exports = {
  server, serve,
};
