/**
 * Module for routes used by ChatServer
 * @module serverRoutes
*/

const express = require('express');
// eslint-disable-next-line new-cap
const router = express.Router();
const pkg = require('../package.json');
const Common = require('./Common');
const {debug} = require('../config');

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

  router.get('/', (req, res) => {
    res.json({data: {app: pkg.name, version: pkg.version}});
  });

  router.post('/room/:name', async (req, res) => {
    if (!validKey(req)) {
      return Common.failure(res);
    }

    const name = req.params.name;
    const {port, message} = await config.ChatServer.createRoom(name);
    res.json({data: {port, message}});
  });

  return router;
};
