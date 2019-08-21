// main entry into Child process (a chatroom)

const name = process.env.name;
const port = process.env.port;
if (!name || !port) {
  console.error('Cannot create chatroom with empty name or port.');
  process.exit(1);
}

const {debug} = require('../config');
const http = require('http');
const WebSocketServer = require('websocket').server;
const ChatRoom = require('../modules/ChatRoom');

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'X-Requested-With',
    'Content-Type': 'text/plain; charset=utf-8',
  });

  res.end(name);
});

server.listen(port, () => {
  // redo
  // send master our assigned port #
  debug(`worker pid ${process.pid} listening on ${server.address().port}`);
  process.send({
    type: 'port',
    port: server.address().port,
  });
});

const wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false,
});

/**
 * @param  {string} origin
 * @return {boolean}
 */
function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  console.log(origin);
  return true;
}

wsServer.on('request', function(request) {
  if (!originIsAllowed(request.origin)) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
    return;
  }

  const connection = request.accept(null, request.origin);
  console.log((new Date()) + ' Connection accepted.');
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      console.log('Received Message: ' + message.utf8Data);
      ChatRoom.handleMsg(message);
      // connection.sendUTF(message.utf8Data);
    }
  });

  connection.on('close', function(reasonCode, description) {
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
  });
});

// message sent from master process
process.on('message', (msg) => {
  switch (msg.type) {
    case 'shutdown':
      server.close(() => {
        wsServer.closeAllConnections();
        process.exit(0);
      });
      break;
  }
});
