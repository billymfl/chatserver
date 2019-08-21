/**
 * Module for routes used by AdminServer
 * @module adminRoutes
*/
console.log('adminRoutes');
const os = require('os');
const express = require('express');
// eslint-disable-next-line new-cap
const router = express.Router();
const pkg = require('../package.json');
const Common = require('./Common');

// const {debug} = require('../config');

module.exports = (config) => {
  /**
       * Check the API key was sent and is valid
       * @param  {object} req
       * @return {boolean} true if API key is set and valid
       */
  function validKey(req) {
    const key = req.header('X-API-Key');
    return key !== '' && key === config.key;
  }

  Common.setupRouter(router, config);

  /*
    * Validate all requests to admin api
    */
  router.use((req, res, next) => {
    if (!validKey(req)) {
      Common.failure(res);
    }
    next();
  });

  router.get('/', (req, res) => {
    res.json({data: {app: `Admin ${pkg.name}`, version: pkg.version}});
  });

  /**
   * GET /load
   * @returns server load info
   */
  router.get('/load', (req, res) => {
    const total =os.totalmem();
    const free = os.freemem();
    const cpus = config.ChatServer.getCpus();
    const data = {
      loadAvg: os.loadavg(),
      totalMemory: total,
      freeMemory: free,
      percentage: Math.floor( ((total-free)/total)*100 ),
      cpus: cpus,
      rooms: config.ChatServer.getRooms().join(','),
      capacity: cpus - config.ChatServer.getNumRooms(),
      osUpTime: os.uptime(),
      upTime: config.ChatServer.getUpTime(),
      acceptingConnections: config.ChatServer.getAcceptingConnections(),
    };
    res.json({data: data});
  });

  router.delete('/shutdown', (req, res) => {

  });

  /*
    * Admin requesting to shutdown a chat room. The request is handly async.
      If room is already closed return 200, else return 202 and name.
    */
  router.delete('/room/:name/shutdown', (req, res) => {
    const name = req.params.name;
    const {status, message} = config.ChatServer.closeRoom(name);
    res.status(status).json({data: {name, message}});
  });

  return router;
};
