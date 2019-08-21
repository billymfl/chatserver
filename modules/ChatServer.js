/**
 * Module for ChatServer singleton
 * @module ChatServer
*/

const os = require('os');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const cluster = require('cluster');
const portastic = require('portastic');
const _ = require('underscore');
const routes = require('./serverRoutes');
const adminRoutes = require('./adminRoutes');
const Common = require('./Common');
const CircuitBreaker = require('./CircuitBreaker');
const {debug} = require('../config');

let instance;

/** Class representing a ChatServer. */
class ChatServer {
  /**
     * Creates a ChatServer by listening on a port for API calls
     * @constructor
     * @param {object} config - Configuration options for the ChatServer
     */
  constructor(config) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = config.NODE_ENV !== 'production' ? '0' : '1';

    /**
    How long server has been up
    @name ChatServer#upTime
    @type Date
    */
    this.upTime;

    /**
    Number of cpu cores available to spawn chatrooms in
    @name ChatServer#cpus
    @type Number
    */
    this.cpus = os.cpus().length - 1;

    /**
    Number of rooms created
    @name ChatServer#rooms
    @type Number
    @default 0
    */
    this.rooms = 0;

    /**
    Reference to interval that calls loadbalancers
    @name ChatServer#updateInterval
    @type Number
    @default null
    */
    this.updateInterval;

    /**
    If we are accepting connections
    @name ChatServer#acceptingConnections
    @type Boolean
    @default false
    */
    this.acceptingConnections = false;

    /**
    If we are busy creating a chatroom
    @name ChatServer#processing
    @type Boolean
    @default false
    */
    this.processing = false;

    /**
    A mapping of room name => port for quick lookup
    @name ChatServer#roomPort
    @type Array
    */
    this.roomPort = [];

    /**
    A mapping of worker.id => {name, worker obj} for quick lookup
    @name ChatServer#workers
    @type Array
    */
    this.workers = [];

    /**
    Circuit breaker for loadbalancer calls
    @name ChatServer#circuitBreaker
    @type Object
    */
    this.circuitBreaker = new CircuitBreaker();

    /**
    Our host and port for the loadbalancers
    @name ChatServer#host
    @type string
    */
    this.host = encodeURIComponent(`${config.HOST}:${config.PORT}`);

    /**
    List of loadbalancer hosts
    @name ChatServer#loadbalancers
    @type Array
    */
    this.loadbalancers = [];

    /**
    App version
    @name ChatServer#version
    @type string
    */
    this.version = config.VERSION;

    /**
    Loadbalancer API key
    @name ChatServer#lbKey
    @type string
    */
    this.lbKey = config.LOADBALANCER_KEY;

    this.server;
    this.app;
    this.adminServer;
    this.adminApp;

    try {
      this.loadbalancers = config.LOADBALANCERS.split(',');
    } catch (err) {
      ;
    }

    // specify the code to run when a chatroom spawns and env vars to pass
    cluster.setupMaster({exec: 'server/chatroom.js', args: ['NODE_ENV', config.NODE_ENV]});
    cluster.on('exit', (worker, code, signal) => {
      console.info('Worker ' + worker.process.pid + ' died');
    });

    this._initAdminServer(config, () =>{
      this._initChatServer(config);
    });
  }

  /** Starts a server listening on an admin port. On success the chatserver is started
   * @param  {object} config
   * @param {Function} cb Callback to start chatserver
   */
  _initAdminServer(config, cb) {
    const app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.urlencoded({extended: true}));

    const routesConfig = {ChatServer: this, key: config.ADMIN_KEY, ...Common.headers};
    app.use('/api/v1/', adminRoutes(routesConfig));
    this.adminApp = app;

    this.adminServer = http.createServer(app).listen(config.ADMIN_PORT, () => {
      // eslint-disable-next-line max-len
      console.log(`Admin for ${config.APPNAME} ${config.VERSION} in ${config.NODE_ENV} listening at http://0.0.0.0:${this.adminServer.address().port}`);
      cb();
    });
  }

  /**
   * @param  {object} config
   */
  _initChatServer(config) {
    const app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.urlencoded({extended: true}));

    const routesConfig = {ChatServer: this, key: config.KEY, ...Common.headers};
    app.use(`/api/v1/`, routes(routesConfig));

    this.app = app;

    // eslint-disable-next-line max-len
    const msg = `${config.APPNAME} ${config.VERSION} is starting in ${config.NODE_ENV} mode. CPUs: ${os.cpus().length}`;
    debug(msg);

    this.server = http.createServer(app).listen(config.PORT, () => {
      // eslint-disable-next-line max-len
      console.log(`${config.APPNAME} ${config.VERSION} in ${config.NODE_ENV} listening at http://0.0.0.0:${this.server.address().port}`);
      this._startup();
    });

    this.server.on('close', () => {
      this.acceptingConnections = false;
      this.adminServer.close();
      clearInterval(this.updateInterval);
    });
  }


  /**
  * start heartbeat interval and registering with loadbalancers
  * @private
  */
  _startup() {
    this.acceptingConnections = true;
    this.upTime = new Date().toISOString();
    this.updateInterval = setInterval(() => {
      this.register();
    }, 10000);
    this.register();
  }

  /** Registers listeners on the chatroom
   *
   * @private
   * @param  {object} worker
   */
  _setupWorker(worker) {
    // chatroom is spawned
    worker.on('online', () => {
      // eslint-disable-next-line max-len
      debug(`# of Workers: ${_.size(cluster.workers)}. Worker id ${worker.id}, ${worker.process.pid} is online.`);
    });

    // chatroom sent us a message
    worker.on('message', (msg) => {
      const util = require('util');
      // eslint-disable-next-line max-len
      debug(`worker ${worker.process.pid} has sent a message to master: ${util.inspect(msg, true, 2)}`);
      switch (msg.type) {
        case 'port':
          const name = this.workers[worker.id].name;
          this.roomPort[name] = msg.port;
          break;

        default:
          ;
      }
    });

    // chatroom exitted for some reason and we need to clean up
    worker.on('exit', (code, signal) => {
      if (signal) {
        console.error(`worker ${worker.id} was killed by signal ${signal}`);
      } else if (code !== 0) {
        console.error(`worker ${worker.id} exited with error code ${code}`);
      } else {
        console.info(`worker ${worker.id} shutdown successfully`);
      }
      this._cleanupWorker(worker);
    });

    worker.on('disconnect', () => {
      console.info(`worker id ${worker.id}, pid ${worker.process.pid} disconnected`);
      this._cleanupWorker(worker);
    });
  }

  /** Clean up properties when a chatroom process ends
   *
   * @private
   * @param  {object} worker
   */
  _cleanupWorker(worker) {
    if (this.workers[worker.id]) {
      const name = this.workers[worker.id].name;
      delete this.workers[worker.id];
      delete this.roomPort[name];
      this.rooms--;
    }
  }

  /** Find worker based on room name
   *
   * @private
   * @param  {string} name
   * @return {object|null} worker if found otherwise null
   */
  _findWorker(name) {
    for (const id in this.workers) {
      if (this.workers[id].name === name) {
        return this.workers[id].worker;
      }
    }
    return null;
  }


  /**
   * @return {object} The express app object (for testing)
   */
  getApp() {
    return this.app;
  }

  /**
   * @return {object} The express admin app object (for testing)
   */
  getAdminApp() {
    return this.adminApp;
  }

  /**
   * @return {String} The up time of the server
   */
  getUpTime() {
    return this.upTime;
  }

  /**
   * @return {int} Number of cpu cores
   */
  getCpus() {
    return this.cpus;
  }

  /**
 * @return {int} Number of rooms created
 */
  getNumRooms() {
    return this.rooms;
  }

  /**
   * @return {Array} List of room names
   */
  getRooms() {
    return Object.keys(this.roomPort);
  }

  /**
   * @return {boolean}
   */
  getAcceptingConnections() {
    return this.acceptingConnections;
  }

  /** Closes the http server
   * @param  {Function} cb Callback function
   */
  close(cb) {
    this.server.close(cb);
  }

  /**
  * Register or send a heartbeat update to the loadbalancers
  */
  async register() {
    const promises = this.loadbalancers.map((loadbalancer) => {
      // eslint-disable-next-line max-len
      const uri = `${loadbalancer}/register/${this.host}/${this.cpus}/${this.rooms}/${this.version}`;
      const requestOptions = {
        method: 'put',
        url: uri,
        headers: {'X-API-Key': this.lbKey},
      };
      return this.circuitBreaker.callService(requestOptions);
      // return axios.put(uri).then(function(response) {
      //   return response.status;
      // });
    });

    try {
      await Promise.all(promises);
      // debug(res);
    } catch (error) {
      if (error.response) {
        console.error('RES', error.response.status);
      } else if (error.request) {
        // eslint-disable-next-line max-len
        console.error(`Request failure: Loadbalancer at ${error.request._options.hostname}:${error.request._options.port}`);
      } else {
        console.error('Error', error.message);
      }
    }
  }

  /** Creates or returns the named room
   *
   * @param  {string} name Room to create.
   * @return {object} port, message - port -1 if busy processing (try again),
   *                                  port 0 if can't create a room, or
   *                                  actual port # if room already exists
   *                                  or port of newly created room
   */
  async createRoom(name) {
    // return port if room already exists
    if (this.roomPort[name] !== undefined) {
      return {port: this.roomPort[name], message: `${name} already exists`};
    }

    // return -1 if we are busy creating another room
    if (this.processing) {
      return {port: -1, message: 'Cannot create a room at this time'};
    }

    // return 0 if we cannot create more rooms due to cpu core exhaustion
    if (!this.acceptingConnections || this.rooms === this.cpus) {
      return {port: 0, message: 'No more rooms can be created'};
    }

    // we are good to try creating a room by finding an available port
    this.processing = true;
    let port = -1;
    const ports = await portastic.find({min: 34000, max: 34050});
    if (ports.length) {
      port = ports[0];
      // spawn the room and pass it env vars
      const worker = cluster.fork({name, port});
      this.rooms++;
      this.roomPort[name] = port;
      this.workers[worker.id] = {name, worker};
      this._setupWorker(worker);
    }
    this.processing = false;
    return {port, message: 'Room created'};
  }

  /** Closes a chatroom
   *
   * @param  {string} name
   * @return {int} status code. 200 if room is closed, 202 if pending closure
   */
  closeRoom(name) {
    const worker = this._findWorker(name);
    if (worker) {
      worker.send({type: 'shutdown'});
      return {status: 202, message: 'Shutting down'};
    }
    return {status: 200, message: 'Either shutdown already or doesn\'t exist'};
  }
}

// export ChatServer as a singleton
module.exports = (config) => {
  if (instance) {
    return instance;
  }
  instance = new ChatServer(config);
  return instance;
};
