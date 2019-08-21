const axios = require('axios');

/**
 *
 */
class CircuitBreaker {
  /**
   * sets the states/values for the circuit breaker
   */
  constructor() {
    this.states = {};
    this.failureThreshold = 3;
    this.cooldownPeriod = 30;
    this.requestTimeout = 1;
  }

  /**
   * @param  {object} requestOptions
   */
  async callService(requestOptions) {
    const endpoint = `${requestOptions.method}:${requestOptions.url}`;
    // console.log(require('util').inspect(this.states, true, 3));
    if (!this.canRequest(endpoint)) return false;
    // console.log(`calling for ${endpoint}`);
    // eslint-disable-next-line no-param-reassign
    requestOptions.timeout = this.requestTimeout * 1000;

    try {
      const response = await axios(requestOptions);
      this.onSuccess(endpoint);
      return response.data;
    } catch (err) {
      this.onFailure(endpoint);
      return false;
    }
  }
  /** On a successful request reset the circuit breaker
   * @param  {string} endpoint
   */
  onSuccess(endpoint) {
    this.initState(endpoint);
  }

  /** on a failed request record this and see if ciruit should be set to open
   * @param  {string} endpoint
   */
  onFailure(endpoint) {
    const state = this.states[endpoint];
    state.failures += 1;
    if (state.failures > this.failureThreshold) {
      state.circuit = 'OPEN';
      state.nextTry = new Date() / 1000 + this.cooldownPeriod;
      console.log(`ALERT! Circuit for ${endpoint} is in state 'OPEN'`);
    }
  }

  /**
   * @param  {string} endpoint
   * @return {boolean} true if circuit is closed or half open, false otherwise
   */
  canRequest(endpoint) {
    if (!this.states[endpoint]) this.initState(endpoint);
    const state = this.states[endpoint];
    if (state.circuit === 'CLOSED') return true;
    const now = new Date() / 1000;
    if (state.nextTry <= now) {
      state.circuit = 'HALF';
      return true;
    }
    return false;
  }

  /**
   * @param  {string} endpoint
   */
  initState(endpoint) {
    this.states[endpoint] = {
      failures: 0,
      cooldownPeriod: this.cooldownPeriod,
      circuit: 'CLOSED',
      nextTry: 0,
    };
  }
}

module.exports = CircuitBreaker;
