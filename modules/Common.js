/**
 * Module for shared items
 * @module Common
*/

const os = require('os');
const {debug} = require('../config');

module.exports = {
  // common headers
  headers: {accessControlAllowOrigin: '*', xWhom: os.hostname()},

  /** Sets route specific options
   * @param  {object} router
   * @param  {object} opts - config settings
   */
  setupRouter(router, opts) {
    // set some default headers
    router.use((req, res, next) => {
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.set('X-Whom', opts.xWhom);
      res.set('Access-Control-Allow-Origin', opts.accessControlAllowOrigin);
      res.set('Access-Control-Allow-Headers', 'X-Requested-With');
      next();
    });

    router.use((req, res, next) => {
      const ip = this.getIp(req);
      // eslint-disable-next-line max-len
      debug(`${req.url} from: ${ip} ref: ${req.get('Referer')} via: ${req.get('User-Agent')}`);
      next();
    });

    router.use((error, req, res, next) => {
      res.status(error.status || 500);
      console.error(error);
      return res.json({status: 'error', message: error.message});
    });
  },

  /**
   * @param  {object} res
   */
  failure(res) {
    res.status(401).json({message: 'Unauthorized'});
  },

  /** Attempts to get the referring IP
     * @param  {object} req Request
     * @return {string} IP address
     */
  getIp(req) {
    let ip;
    try {
      if (req.headers && req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'] !== '') {
        // eslint-disable-next-line max-len
        ip = (req.headers['x-forwarded-for'].indexOf(',') === -1) ? _.trim(req.headers['x-forwarded-for']) : _.trim(req.headers['x-forwarded-for'].split(',')[0]);
      } else {
        // eslint-disable-next-line max-len
        ip = req.connection.remoteAddress.includes('::') ? `[${req.connection.remoteAddress}]` : req.connection.remoteAddress;
      }
    } catch (e) {
      console.error('possibly failed to get IP. ', e.message);
      ip = (req.ip && req.ip !== '') ? _.trim(req.ip) : '';
    }
    return ip;
  },


};
