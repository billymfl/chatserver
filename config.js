const pkg = require('./package');
const Joi = require('@hapi/joi');

exports.NODE_ENV = process.env.NODE_ENV || 'development';
exports.APPNAME = pkg.name;
exports.VERSION = pkg.version;
exports.debug = require('debug')(exports.APPNAME);

const schema = Joi.object().keys({
  PORT: Joi.number().integer().min(80).max(65535).default('80'),
  ADMIN_PORT: Joi.number().integer().min(8000).max(65535).default('8090'),
  HOST: Joi.string().uri().default('http://0.0.0.0'),
  KEY: Joi.string().token().default(''),
  ADMIN_KEY: Joi.string().token().default(''),
  LOADBALANCER_KEY: Joi.string().token().required(),
  LOADBALANCERS: Joi.string().required(),

});

const result = schema.validate(process.env, {stripUnknown: true});
if (result.error) {
  exports._error = 'Invalid configuration:\n' + result.error.details
      .map((error) => error.message)
      .join('.\n');
} else {
  Object.assign(exports, result.value);
}
