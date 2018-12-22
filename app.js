/* jshint esnext: true */
require('events').EventEmitter.prototype._maxListeners = 0;

var config;
var email;
var functions;
if (process.env.NODE_ENV === 'dev') {
    config = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/api-creator-q/config/dev/config.js');
    email = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/api-creator-q/lib/email_lib.js');
    functions = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/api-creator-q/lib/func_lib.js');
} else {
    config = require('/usr/src/app/config/prod/config.js');
    email = require('/usr/src/app/lib/email_lib.js');
    functions = require('/usr/src/app/lib/func_lib.js');
}

var fs = require("fs");
var express = require("express");
var https = require('https');
var options = {
    key: fs.readFileSync(config.security.key),
    cert: fs.readFileSync(config.security.cert)
};
var app = express();
var bodyParser = require("body-parser");
var cors = require("cors");
var amqp = require('amqplib/callback_api');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("./public"));
app.use(cors());

app.use(function(req, res, next) {
    next();
});

var server = https.createServer(options, app).listen(process.env.CREATOR_Q_SERVICE_PORT || config.port.creator_q_port, function() {
    email.sendNewApiCreatorQIsUpEmail();
});


/**
 *   RabbitMQ connection object
 */
var amqpConn = null;


/**
 *  Subscribe user on topic to receive messages
 */
function subscribeToTopic(topic) {
    if (amqpConn !== null) {
        amqpConn.createChannel(function(err, ch) {
            var exchange = 'apiCreatorQ.*';
            var toipcName = `apiCreatorQ.${topic}`;
            
            ch.assertExchange(exchange, 'topic', { durable: true });
            ch.assertQueue(toipcName, { exclusive: false, auto_delete: true }, function(err, q) {
                ch.bindQueue(q.queue, exchange, toipcName);
                ch.consume(q.queue, function(msg) {
                    var message = JSON.parse(msg.content.toString());
                    if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.saveCreatorTextPost}`){
                        functions.saveCreatorTextPost(message, amqpConn, config.rabbitmq.topics.saveCreatorTextPostQ);
                    } else if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.saveCreatorPost}`){
                        functions.saveCreatorPost(message, amqpConn, config.rabbitmq.topics.saveCreatorPostQ);
                    } else if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.updateCreatorPost}`){
                        functions.updateCreatorPost(message, amqpConn, config.rabbitmq.topics.updateCreatorPostQ);
                    } else if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.likeCreatorPost}`){
                        functions.likeCreatorPost(message, amqpConn, config.rabbitmq.topics.likeCreatorPostQ);
                    } else if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.unlikeCreatorPost}`){
                        functions.unlikeCreatorPost(message, amqpConn, config.rabbitmq.topics.unlikeCreatorPostQ);
                    } else if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.postCommentForCreatorPost}`){
                        functions.postCommentForCreatorPost(message, amqpConn, config.rabbitmq.topics.postCommentForCreatorPostQ);
                    } else if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.deleteCreatorPost}`){
                        functions.deleteCreatorPost(message, amqpConn, config.rabbitmq.topics.deleteCreatorPostQ);
                    } else if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.connectWithCreator}`){
                        functions.connectWithCreator(message, amqpConn, config.rabbitmq.topics.connectWithCreatorQ);
                    } else if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.disconnectWithCreator}`){
                        functions.disconnectWithCreator(message, amqpConn, config.rabbitmq.topics.disconnectWithCreatorQ);
                    } else if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.uploadVideoPost}`){
                        functions.saveCreatorVideoPost(message, amqpConn, config.rabbitmq.topics.uploadVideoPostQ);
                    } else if (toipcName === `apiCreatorQ.${config.rabbitmq.topics.newCreator}`){
                        functions.saveNewCreator(message, amqpConn, config.rabbitmq.topics.newCreatorQ);
                    }
                }, { noAck: true });
            });
        });
    }
}

/**
 *  Connect to RabbitMQ
 */
function connectToRabbitMQ() {
    amqp.connect(process.env.CREATOR_Q_SERVICE_RABBIT_MQ_URL || config.rabbitmq.url, function(err, conn) {
        if (err) {
            console.error("[AMQP]", err.message);
            return setTimeout(connectToRabbitMQ, 1000);
        }
        conn.on("error", function(err) {
            if (err.message !== "Connection closing") {
                console.error("[AMQP] conn error", err.message);
            }
        });
        conn.on("close", function() {
            console.error("[AMQP] reconnecting");
            return setTimeout(connectToRabbitMQ, 1000);
        });
        console.log("[AMQP] connected");
        amqpConn = conn;

        subscribeToTopic(config.rabbitmq.topics.saveCreatorTextPost);
        subscribeToTopic(config.rabbitmq.topics.saveCreatorPost);
        subscribeToTopic(config.rabbitmq.topics.updateCreatorPost);
        subscribeToTopic(config.rabbitmq.topics.likeCreatorPost);
        subscribeToTopic(config.rabbitmq.topics.unlikeCreatorPost);
        subscribeToTopic(config.rabbitmq.topics.postCommentForCreatorPost);
        subscribeToTopic(config.rabbitmq.topics.deleteCreatorPost);
        subscribeToTopic(config.rabbitmq.topics.connectWithCreator);
        subscribeToTopic(config.rabbitmq.topics.disconnectWithCreator);
        subscribeToTopic(config.rabbitmq.topics.uploadVideoPost);
        subscribeToTopic(config.rabbitmq.topics.newCreator);
    });
}
connectToRabbitMQ();


/**
 *  SOCKET.IO listeners
 */
var io = require("socket.io")(server, { transports: ['websocket'] });
io.sockets.on("connection", function(socket) {
    /**
     * on.searchForCreator listens for search requests
     */
    socket.on("searchForCreator", function(userId, creatorName) {
        functions.searchForCreator(userId, creatorName, socket);
    });

    /**
     * on.disconnect listens for disconnect events
     */
    socket.on("disconnect", function() {});
});


/**
 *  Retrieves latest discover section 100 posts 
 */
app.post("/discoverPosts", function(req, res) {
    functions.discoverPosts(req, res);
});


/**
 *  Retrieves latest 100 posts 
 */
app.post("/latestPosts", function(req, res) {
    functions.latestPosts(req, res);
});


/**
 *  Retrieves creator's activity history
 */
app.post("/creatorHistory", function(req, res) {
    functions.creatorHistory(req, res);
});


/**
 *  Retrieves all comments for post with uuid
 */
app.post("/creatorPostComments", function(req, res) {
    functions.creatorPostComments(req, res);
});


/**
 *  Retrieves creators profile
 */
app.post("/creatorContactProfile", function(req, res) {
    functions.creatorContactProfile(req, res);
});


/**
 *  Retrieves all posts for creator with id
 */
app.post("/creatorPosts", function(req, res) {
    functions.creatorPosts(req, res);
});


/**
 *  Retrieves all posts for creator with id and after certain date
 */
app.post("/loadMorePosts", function(req, res) {
    functions.loadMorePosts(req, res);
});


/**
 *  Retrieves all following for creator with id
 */
app.post("/creatorFollows", function(req, res) {
    functions.creatorFollows(req, res);
});


/**
 *  Retrieves 100 followers for creator with id
 */
app.post("/creatorFollowers", function(req, res) {
    functions.creatorFollowers(req, res);
});