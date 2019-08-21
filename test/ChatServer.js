const chai = require('chai');
// const chaiHttp = require('chai-http');

const assert = chai.assert;
// chai.use(chaiHttp);

const {NODE_ENV, APPNAME, VERSION, KEY, ADMIN_KEY, PORT, ADMIN_PORT, HOST,
  LOADBALANCERS, LOADBALANCER_KEY} = require('../config');

describe('new ChatServer()', function() {
  let ChatServer;
  let request;

  before(function() {
    // runs before all tests in this block
    const config = {
      // eslint-disable-next-line max-len
      NODE_ENV, APPNAME, VERSION, KEY, ADMIN_KEY, PORT: 85, ADMIN_PORT: 8095, HOST, LOADBALANCERS, LOADBALANCER_KEY};
    ChatServer = require('../modules/ChatServer')(config);
  });

  // describe('GET /api/v1/', function() {
  //   beforeEach(function() {
  //     request = chai.request(ChatServer.getApp());
  //   });

  //   afterEach(function() {
  //     request.close();
  //   });

  //   it('should return app name and version, and status 200', function(done) {
  //     request
  //         .get('/api/v1/')
  //         .end((err, res) => {
  //           assert.equal(res.body.data.app, APPNAME);
  //           assert.equal(res.body.data.version, VERSION);
  //           assert.equal(res.status, 200);
  //           done();
  //         });
  //   });
  // });

  it('should be a singleton', function() {
    const ChatServer2 = require('../modules/ChatServer')();
    assert.deepEqual(ChatServer, ChatServer2);
  });

  const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  describe('#createRoom(name)', function() {
    let res;
    before(async function() {
      // runs before all tests in this block
      this.timeout(2000);
      res = await ChatServer.createRoom('mock_room');
      // use sleep to wait for child to fork and start listening so port # is used
      await sleep(1000);
    });

    it('should create a chat room', function(done) {
      assert.isAbove(res.port, 0);
      done();
    });

    it('should return same port number when creating room with same name', async function() {
      const res2 = await ChatServer.createRoom('mock_room');
      assert.equal(res.port, res2.port);
    });

    it('should return new port number when creating a new room', async function() {
      this.timeout(2000);
      const res2 = await ChatServer.createRoom('mock_room2');
      await sleep(1000);
      assert.notEqual(res.port, res2.port);
    });
  });

  describe('#createRoom(name) multiple rooms', function() {
    it('should create multiple rooms with different port #s', async function() {
      const cpus = require('os').cpus().length-4;
      this.timeout(2000*cpus);
      let i = 0;
      const ports = [];
      while (i < cpus) {
        const res = await ChatServer.createRoom(i);
        ports.push(res.port);
        i++;
        await sleep(1000);
      }
      assert.lengthOf(ports, 4);

      // make sure ports are unique and didn't get a dup
      const obj = Object.assign(...ports.map((k) => ({[k]: 0})));
      const keys = Object.keys(obj);
      assert.lengthOf(keys, 4);
    });

    it('should return 0 for port # when cannot create more rooms', async function() {
      const cpus = require('os').cpus().length;
      this.timeout(2000*cpus);
      let i = 0;
      let lastPort;
      while ( i < cpus) {
        lastPort = await ChatServer.createRoom(i);
        i++;
        await sleep(1000);
      }

      assert.equal(lastPort.port, 0);
    });
  });

  // describe('AdminServer', function() {
  //   describe('GET /api/v1/', function() {
  //     let request2;
  //     beforeEach(function() {
  //       request2 = chai.request('http://0.0.0.0:8095');
  //     });

  //     afterEach(function() {
  //       request2.close();
  //     });

  //     it('should return status 400 when no api key passed', function(done) {
  //       request2
  //           .get('/api/v1/')
  //           .end((err, res) => {
  //             console.log(res);
  //             assert.equal(res.status, 400);
  //             done();
  //           });
  //     });


  //   });
  // });
});
