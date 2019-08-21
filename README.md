# chatserver

This is a work in progress refactor of a Chat platform I designed for one of my previous companies. The old version has proprietary code that needs to be factored out, and the new code uses the latest modules (ex native WebSockets vs socket.io) and latest LTS version of node.js.

ChatServer creates 2 listeners, one for chat server to handle api requests to create chat rooms (port 80 default), and an admin api interface (port 8090 default) to
handle admin functions (shut down rooms, server, send global messages to rooms, etc)

Some items are currently missing (ex, the front end SPA to interact with the chatroom).

## Security

NGINX should be used for concerns such as handling TLS (SSL), gzip compression, caching, etc, and passing requests to the app. 

A Process manager (ex: Forever) should be used to handle restarting crashed app and related concerns.

A log aggregation service (ex: Splunk) should be used to ingest logging data sent to stdout/stderr for archival, indexing, monitoring and other related concerns. Only fatal errors are logged on Production.

## Usage

Assuming a docker image was built from [loadbalancer repo](../loadbalancer),

```bash
# start 2 instances of the loadbalancer listening on ports 2000 and 2001
docker-compose up -d

# start chatserver
KEY=TESTING_KEY LOADBALANCERS='https://0.0.0.0:2000,https://0.0.0.0:2001' LOADBALANCER_KEY=LB_TESTING_KEY ADMIN_KEY=<ADMIN_KEY> PORT=80 npm start
```

## Check ChatServer is up
```bash
curl http://0.0.0.0:80/api/v1/
```

Returns
```json
{"data":{"app":"chatserver","version":"1.0.0"}
```

## Check admin interface
```bash
curl -H "X-API-Key: <ADMIN_KEY>" https://0.0.0.0:8090/api/v1/
```

Returns
```json
{"data":{"app":"Admin chatserver","version":"1.0.0"}
```
## Create a chatroom
```bash
curl -X POST -H "X-API-Key: <KEY>" http://0.0.0.0:80/api/v1/room/testroom
```

Returns port of newly created room and a message
```json
{"data":{"port":34000,"message":"Room created"}}
```

## Access URL of chatroom to get room's name
```bash
curl http://0.0.0.0:34000
```

Returns
```bash
testroom
```

