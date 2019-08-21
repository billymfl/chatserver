/**
 * A chatserver listens for requests to create a chatroom and
 * creates one if there are available CPU cores as each room is forked
 * into it's own process. Websockets are used for browser to chatroom communication.
 * Each chatserver registers with the Loadbalancer microservice to send its load info.
 * A User requesting to create a chatroom will query the Loadbalancer and the least loaded
 * chatserver is returned. Least loaded is defined by # of CPUs minus rooms created = free capacity.
 */

const {NODE_ENV, APPNAME, VERSION, KEY, PORT, HOST, ADMIN_KEY, ADMIN_PORT,
  LOADBALANCERS, LOADBALANCER_KEY, _error} = require('../config');

if (_error !== undefined) {
  console.error(_error);
  process.exit(1);
}

const config = {NODE_ENV, APPNAME, VERSION, KEY, PORT, HOST, LOADBALANCERS, LOADBALANCER_KEY,
  ADMIN_KEY, ADMIN_PORT};

const ChatServer = require('../modules/ChatServer')(config);

process.on('SIGTERM', () => {
  console.log('Received SIGTERM');

  ChatServer.close(() => {
    process.exit(0);
  });
});

