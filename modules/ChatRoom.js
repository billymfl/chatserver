/**
 * Module for ChatRoom singleton
 * @module ChatRoom
*/

/** Class representing a ChatRoom */
class ChatRoom {
  /**
       * Creates a ChatRoom
       * @constructor
       * @param {object} config - Configuration options for the AdminServer
       */
  constructor() {
    this.clients = [];
  }

  /**
   * @param  {object} msg
   */
  handleMsg(data) {
    try {
      const msg = JSON.parse(data.utf8Data);
    } catch (err) {

    }
    switch (msg) {

    }
  }
}

module.exports = new ChatRoom();
