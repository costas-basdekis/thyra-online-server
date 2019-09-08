const socketIo = require('socket.io');
const {server} = require('../server');

const io = socketIo(server, {
  //origins: '*:*',
  handlePreflightRequest: (req, res) => {
    const headers = {
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Origin": req.headers.origin, //or the specific origin you want to give access to,
        "Access-Control-Allow-Credentials": true
    };
    res.writeHead(200, headers);
    res.end();
  },
});

module.exports = {
  io,
};
