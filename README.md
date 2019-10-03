# WIP: Chat Server

This is a work in progress reworking of a Video chat platform I designed for one of my previous companies. The old version has proprietary code that needs to be factored out. The new code will use the latest modules (ex native WebSockets vs socket.io) and latest LTS version of Node.js. The original code was designed when Node.js was still at ver 0.8 and some modules, like cluster, were in an experimental stage (and deployed to production servers and ran without any major issues).

**Architecture:** Monolithic app with supporting microservices  
**Back-end:** Node.js  
**Backing store:** MongoDB  
**Front-end:** RoR app SPA using AngularJS. JWplayer for HTML5 HLS video stream.  
**Communication:** REST Api, WebSockets, Ajax polling  
**Support services:** Microservices (loadbalancer service, listing service)



ChatServer creates 2 listeners, one for chat server to handle api requests to create chat rooms (port 80 default), and an admin api interface (port 8090 default) to
handle admin functions (shut down rooms, server, send global messages to rooms, etc)

Some items are currently missing (ex, the front end SPA to interact with the chatroom).

## Background
This is a 3rd rewrite and re-architecture of a video chat platform I helped developed at a company I worked for. The first version 
used [Adobe Flash Media Server](https://en.wikipedia.org/wiki/Adobe_Flash_Media_Server) as the back end server programmed in [ActionScript](https://en.wikipedia.org/wiki/ActionScript), and video streaming via [RTMP](https://en.wikipedia.org/wiki/Real-Time_Messaging_Protocol). The front end involved 2 Flash apps, a single producer for starting broadcasts and the other for multiple consumers. In house servers were used. As the video chat platform became popular we undertook to creating a 2nd version to handle scaling and streaming issues we ran into with the first version. 

For the second version of the video chat platform we settled on using [Wowza Streaming Engine](https://www.wowza.com/products/streaming-engine). It's a Java based application with a Java SDK. The front end apps were rewritten with [Adobe Flex](https://en.wikipedia.org/wiki/Apache_Flex). The application was deployed to AWS and ran on EC2 instances located in different regions to reduce video streaming latency. The initial Java code for the back end was written by a contractor and handed over me to finish building out the code. The system handled well for awhile until we started running into scaling issues again. Also the system wasn't coded with full concurrency and we would run into issues where chat messages flooding one chat room would slow down the server (and every other chat room). We also ran into a lot of ConcurrentModificationExceptions. This was the second time I worked with Java (the first was building the Jeopardy game in Java Swing) and my first time using Java's threads. Needless to say I had a lot of learning to do about Java's concurrency (and a major refactoring of the app over one weekend when a major bug with a race condition was found). 

The third (and final) re-architecture of the video chat platform was my project to spearhead, and besides one supporting monolithic app (assigned to a contractor), the majority of the rewrite was undertaken by me. The goals of the new system were:
1) Solve recurring scaling issues. 
2) Start process of moving away from Adobe Flash, and also reduce reliance on Wowza as the back end for chat and only use it for video streaming.
3) Better support for mobile devices. 
4) Easily add more features to back end and front end.
5) Optimize costs. 

Around this time I was playing with Node.js, and I decided to make a proof of concept to see how we could use it as the backend to power the real time chat. I liked Node's concurrency and decided to use each cpu core as a chat room worker. The master process would handle caching data from the data store and pass that data to each chat room to reduce load on the MongoDB. 

### Role of master process
1) Register and send healthcheck to load balancers.
2) Load and cache some data from MongoDB. Periodically update this data and pass it on to children.
3) Listen for API requests for chat room creation and spawn off a process.
4) Admin functions (stop accepting connections, broadcast global messages, restart server, etc).

### Role of chat room worker process
1) Ask master for cached data on start up.
2) Communication with clients through Websockets (actually, socket.io to support browsers that don't work with Websockets).
3) Chat room functions.
4) Interact with internal and external services through their APIs (i.e., listing service, credit monitoring service, etc).

I had to make sure the master process was resilient (and the chat processes) because if it went down then all chat room workers on that server will die. I used the now deprecated Domain module to keep the processes from crashing even though best practices say that the process should crash and be restarted since we no longer are sure that we have a safe application state.
The exceptions would be logged for further inspection and bug fixes.

For the front end SPAs (for producer and consumers) I reviewed React, Vue, Backbone, and AngularJS. I needed to select a framework that I could quickly get up and running with code and in my case that turned out to be AngularJS. I needed to be able to easily add new features and integrate assets (images, css, jQuery) designed by the team graphics artist.

I quickly got a POC up (Node.js server/chat, and 2 SPAs) and it worked great. I then set about coding up the real thing which would take several months.

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

