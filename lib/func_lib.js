/* jshint esnext: true */
var config;
var email;
var time;
if (process.env.NODE_ENV === 'dev') {
    config = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/api-creator-q/config/dev/config.js');
    email = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/api-creator-q/lib/email_lib.js');
    time = require('/Users/nikolajuskarpovas/Desktop/AWS/chatster_microservices/api-creator-q/lib/time_lib.js');
} else {
    config = require('/usr/src/app/config/prod/config.js');
    email = require('/usr/src/app/lib/email_lib.js');
    time = require('/usr/src/app/lib/time_lib.js');
}

/**
 *  Publishes message on apiCreatorC topic
 */
function publishToApiCreatorC(message, amqpConn, topic) {
    if (amqpConn !== null) {
        amqpConn.createChannel(function(err, ch) {
            var exchange = 'apiCreatorC.*';
            var key = 'apiCreatorC.' + topic;
            ch.assertExchange(exchange, 'topic', { durable: true });
            ch.publish(exchange, key, Buffer.from(message));
        });
    }
}


/**
 *  Setup the pool of connections to the db so that every connection can be reused upon it's release
 *
 */
var mysql = require('mysql');
var Sequelize = require('sequelize');
const sequelize = new Sequelize(
    process.env.CREATOR_Q_SERVICE_DB || config.db.name,
    process.env.CREATOR_Q_SERVICE_DB_USER || config.db.user_name, 
    process.env.CREATOR_Q_SERVICE_DB_PASSWORD || config.db.password, {
        host: process.env.CREATOR_Q_SERVICE_DB_HOST || config.db.host,
        dialect: process.env.CREATOR_Q_SERVICE_DB_DIALECT || config.db.dialect,
        port: process.env.CREATOR_Q_SERVICE_DB_PORT || config.db.port,
        operatorsAliases: process.env.CREATOR_Q_SERVICE_DB_OPERATORS_ALIASES || config.db.operatorsAliases,
        pool: {
            max: process.env.CREATOR_Q_SERVICE_DB_POOL_MAX || config.db.pool.max,
            min: process.env.CREATOR_Q_SERVICE_DB_POOL_MIN || config.db.pool.min,
            acquire: process.env.CREATOR_Q_SERVICE_DB_ACQUIRE || config.db.pool.acquire,
            idle: process.env.CREATOR_Q_SERVICE_DB_IDLE || config.db.pool.idle
        }
    }
);


/**
 *  Saves new creator into database
 *
 * (creator Object): Object that holds all the creator data
 * (amqpConn Object): RabbitMQ connection object that is used to send message on topic
 * (topic String): Topic on which response is to be published
 */
module.exports.saveNewCreator = function (creator, amqpConn, topic) {
    sequelize.query('CALL SaveNewCreator(?,?,?,?,?,?,?,?)',
    { replacements: [ creator.creatorId, creator.creatorName, creator.profilePic, creator.statusMessage, creator.creatorPosts, creator.creatorProfileViews, 
        creator.creatorTotalLikes, creator.creatorWebsite ], type: sequelize.QueryTypes.RAW }).then(result => {
            var response = {
                status: config.rabbitmq.statuses.ok
            };
            publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
    }).error(function(err){
        email.sendApiCreatorQErrorEmail(err);
        var response = {
            status: config.rabbitmq.statuses.error
        };
        publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
    });
}


/**
 *  Stores creators text post
 *
 * (userName String): creators user name
 * (postCapture String): text that appears under the post
 * (creatorProfilePic String): String that holds the URL of profile image of creator
 * (post String): post text
 * (postUUID String): uuid of the post
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.saveCreatorTextPost = function (message, amqpConn, topic) {
    sequelize.query('CALL ProcessNewCreatorTextPost(?,?,?,?,?,?,?,?,?,?,?)',
    { replacements: [ message.postUUID, message.userName, message.postCapture, message.postType, message.postText, message.likes, message.comments,
        message.createdAt, message.lastUpdatedAt, message.type, message.notificationMessage ],
        type: sequelize.QueryTypes.RAW }).then(result => {
            var response = {
                status: config.rabbitmq.statuses.ok
            };
            publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
    }).error(function(err){
        email.sendApiCreatorQErrorEmail(err);
        var response = {
            status: config.rabbitmq.statuses.error
        };
        publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
    });
};


/**
 *  Stores creators image post
 *
 * (userName String): creators user name
 * (postCapture String): text that appears under the post
 * (creatorProfilePic String): String that holds the URL of profile image of creator
 * (post String): base64 encoded String that holds the image
 * (postUUID String): uuid of the post
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.saveCreatorPost = function (message, amqpConn, topic) {
    sequelize.query('CALL ProcessNewCreatorPost(?,?,?,?,?,?,?,?,?,?,?)',
    { replacements: [ message.postUUID, message.userName, message.postCapture, message.postType, message.likes, message.comments, message.createdAt,
        message.lastUpdatedAt, message.type, message.notificationMessage, message.postUrl ],
        type: sequelize.QueryTypes.RAW }).then(result => {
            var response = {
                status: config.rabbitmq.statuses.ok
            };
            publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
    }).error(function(err){
        email.sendApiCreatorQErrorEmail(err);
        var response = {
            status: config.rabbitmq.statuses.error
        };
        publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
    });
};

/**
 *  Updates creators post, not implemented yet
 *
 * (userName String): creators user name
 * (postCapture String): text that appears under the post
 * (creatorProfilePic String): String that holds the URL of profile image of creator
 * (post String): base64 encoded String that holds the image
 * (postUUID String): uuid of the post
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.updateCreatorPost = function (message, amqpConn, topic) {
};


/**
 *  Likes creators post
 *
 * (userName String): creators user name
 * (postUUID String): uuid of the post
 * (userProfilePicUrl String): String that holds the URL of profile image of the user who likes this post
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.likeCreatorPost = function (message, amqpConn, topic) {
  sequelize.query('CALL ProcessNewCreatorPostLike(?,?,?,?,?)',
  { replacements: [ message.postUUID, message.userName, message.lastUpdatedAt, message.type, message.notificationMessage ],
      type: sequelize.QueryTypes.RAW }).then(result => {
        var response = {
            status: config.rabbitmq.statuses.ok
        };
        publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      var response = {
        status: config.rabbitmq.statuses.error
    };
    publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  });
};


/**
 *  Unlikes creators post
 *
 * (userName String): creators user name
 * (postUUID String): uuid of the post
 * (userProfilePicUrl String): String that holds the URL of profile image of the user who unlikes this post
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.unlikeCreatorPost = function (message, amqpConn, topic) {
  sequelize.query('CALL ProcessNewCreatorPostDisLike(?,?,?,?,?)',
  { replacements: [ message.postUUID, message.userName, message.lastUpdatedAt, message.type, message.notificationMessage],
      type: sequelize.QueryTypes.RAW }).then(result => {
        var response = {
            status: config.rabbitmq.statuses.ok
        };
        publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      var response = {
        status: config.rabbitmq.statuses.error
    };
    publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  });
};


/**
 *  Saves comment on creators post
 *
 * (userName String): creators user name
 * (userProfilePicUrl String): String that holds the URL of profile image of the user who comments on this post
 * (postUUID String): uuid of the post
 * (comment String): comment for the post
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.postCommentForCreatorPost = function (message, amqpConn, topic) {
  var myutc = time.getCurrentUTC();
  sequelize.query('CALL ProcessNewCreatorPostComment(?,?,?,?,?,?,?)',
  { replacements: [ message.postUUID, message.userName, message.comment, message.createdAt, message.lastUpdatedAt, message.type, message.notificationMessage ],
      type: sequelize.QueryTypes.RAW }).then(result => {
        var response = {
            status: config.rabbitmq.statuses.ok
        };
        publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      var response = {
        status: config.rabbitmq.statuses.error
    };
    publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  });
};


/**
 *  Deletes creators post
 *
 * (postUUID String): uuid of the post
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.deleteCreatorPost = function (message, amqpConn, topic) {
  sequelize.query('CALL DeleteCreatorPost(?)',
  { replacements: [ message.postUUID ],
      type: sequelize.QueryTypes.RAW }).then(result => {
        var response = {
            status: config.rabbitmq.statuses.ok
        };
        publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      var response = {
        status: config.rabbitmq.statuses.error
    };
    publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  });
};


/**
 *  Connects this creator another with creator
 *
 * (userId String): userId of creator who wants to connect with another creator
 * (userName String): user name of creator who wants to connect with another creator
 * (photoUrl String): user profile picture URL of creator who wants to connect with another creator
 * (creatorName String): creator name of creator with whom this user wants to connect
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.connectWithCreator = function (message, amqpConn, topic) {
  sequelize.query('CALL ProcessNewCreatorFollower(?,?,?,?,?)',
  { replacements: [ message.userId, message.creatorName, message.type, message.notificationMessage, message.createdAt ],
      type: sequelize.QueryTypes.RAW }).then(result => {
        var response = {
            status: config.rabbitmq.statuses.ok
        };
        publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      var response = {
        status: config.rabbitmq.statuses.error
    };
    publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  });
};


/**
 *  Disconnects from this creator
 *
 * (userId String): userId of creator who wants to disconnect with another creator
 * (userName String): user name of creator who wants to disconnect with another creator
 * (photoUrl String): user profile picture URL of creator who wants to disconnect with another creator
 * (creatorName String): creator name of creator with whom this user wants to disconnect
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.disconnectWithCreator = function (message, amqpConn, topic) {
  sequelize.query('CALL ProcessDeleteCreatorFollower(?,?,?,?,?)',
  { replacements: [ message.userId, message.creatorName, message.type, message.notificationMessage, message.createdAt ],
      type: sequelize.QueryTypes.RAW }).then(result => {
        var response = {
            status: config.rabbitmq.statuses.ok
        };
        publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      var response = {
        status: config.rabbitmq.statuses.error
    };
    publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
  });
};


/**
 *  Searches for creator who's name starts with
 *
 * (userId String): userId of creator who searches for another creator
 * (name String): creator name of creator for whom this user searches
 * (socket Object): Socket.IO object that is used to send user response
 */
module.exports.searchForCreator = function (userId, name, socket) {
  var searchResultCreators = [];
  sequelize.query('CALL GetUserWithNameStartsWith(?,?)',
  { replacements: [ name, userId.toString() ],
      type: sequelize.QueryTypes.RAW }).then(result => {
          if(result.length > 0){
              for (var i = 0; i < result.length; i++) {
                  var creator = {
                      creatorId: result[i].creator_name,
                      statusMessage: result[i].creator_status_message,
                      profilePic: result[i].creator_profile_pic,
                      posts: result[i].creator_posts,
                      creatorFollowers: 0,// this value is not being displayed to the user
                      creatorFollowing: 0,// this value is not being displayed to the user
                      creatorProfileViews: result[i].creator_profile_views,
                      creatorTotalLikes: result[i].creator_total_likes,
                      website: result[i].creator_website,
                      followingThisCreator: 0// this value is not being displayed to the user
                  };
                  searchResultCreators.push(creator);
              }
          }
          socket.emit("searchForCreator", JSON.stringify(searchResultCreators));
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      socket.emit("searchForCreator", JSON.stringify(searchResultCreators));
  });
};

/**
 *  Retrieves latest 100 posts 
 *
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
module.exports.discoverPosts = function (req, res){
  var discoverPosts = [];
  var postUrls = [];
  sequelize.query('CALL GetDiscoverPosts( )',
  { replacements: [  ],
      type: sequelize.QueryTypes.RAW }).then(result => {
          if(result.length > 0){
              for(var i = 0; i < result.length; i++){
                  var next = i+1;
                  if(result.length > next){
                      if(result[i].post_uuid === result[next].post_uuid){
                          postUrls.push(result[i].post_url);
                      }else{
                          postUrls.push(result[i].post_url);
                          var creatorPost = {
                              uuid: result[i].post_uuid,
                              creatorProfilePicUrl: result[i].creator_profile_pic,
                              creatorsName: result[i].creator_name,
                              postUrls: postUrls,
                              postCaption: result[i].post_caption,
                              postType: result[i].post_type,
                              postText: result[i].post_text !== null ? result[i].post_text : result[i].post_type,
                              likes: result[i].likes,
                              comments: result[i].comments,
                              postCreated: result[i].item_created,
                              followingThisCreator: 0
                          };
                          discoverPosts.push(creatorPost);
                          postUrls = [];
                      }
                  }else{
                      postUrls.push(result[i].post_url);
                      var myCreatorPost = {
                          uuid: result[i].post_uuid,
                          creatorProfilePicUrl: result[i].creator_profile_pic,
                          creatorsName: result[i].creator_name,
                          postUrls: postUrls,
                          postCaption: result[i].post_caption,
                          postType: result[i].post_type,
                          postText: result[i].post_text !== null ? result[i].post_text : result[i].post_type,
                          likes: result[i].likes,
                          comments: result[i].comments,
                          postCreated: result[i].item_created,
                          followingThisCreator: 0
                      };
                      discoverPosts.push(myCreatorPost);
                      postUrls = [];
                  }
              }
          }
          res.json(discoverPosts);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      res.json(discoverPosts);
  });
};

/**
 *  Retrieves latest 100 posts of creators who this user is following 
 *
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
module.exports.latestPosts = function (req, res){
  var latestPosts = [];
  var postUrls = [];
  sequelize.query('CALL GetLatestPosts(?,?)',
  { replacements: [ req.query.creator, req.query.creatorsName ],
      type: sequelize.QueryTypes.RAW }).then(result => {
          if(result.length > 0){
              for(var i = 0; i < result.length; i++){
                  var next = i+1;
                  if(result.length > next){
                      if(result[i].post_uuid === result[next].post_uuid){
                          postUrls.push(result[i].post_url);
                      }else{
                          postUrls.push(result[i].post_url);
                          var creatorPost = {
                              uuid: result[i].post_uuid,
                              creatorProfilePicUrl: result[i].creator_profile_pic,
                              creatorsName: result[i].creator_name,
                              postUrls: postUrls,
                              postCaption: result[i].post_caption,
                              postType: result[i].post_type,
                              postText: result[i].post_text !== null ? result[i].post_text : result[i].post_type,
                              likes: result[i].likes,
                              comments: result[i].comments,
                              postCreated: result[i].item_created,
                              followingThisCreator: 0
                          };
                          latestPosts.push(creatorPost);
                          postUrls = [];
                      }
                  }else{
                      postUrls.push(result[i].post_url);
                      var myCreatorPost = {
                          uuid: result[i].post_uuid,
                          creatorProfilePicUrl: result[i].creator_profile_pic,
                          creatorsName: result[i].creator_name,
                          postUrls: postUrls,
                          postCaption: result[i].post_caption,
                          postType: result[i].post_type,
                          postText: result[i].post_text !== null ? result[i].post_text : result[i].post_type,
                          likes: result[i].likes,
                          comments: result[i].comments,
                          postCreated: result[i].item_created,
                          followingThisCreator: 0
                      };
                      latestPosts.push(myCreatorPost);
                      postUrls = [];
                  }
              }
          }
          res.json(latestPosts);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      res.json(latestPosts);
  });
};

/**
 * Sorts an array by date
 */
var sortBy = (function () {
    var toString = Object.prototype.toString,
        // default parser function
        parse = function (x) { return x; },
        // gets the item to be sorted
        getItem = function (x) {
          var isObject = x != null && typeof x === "object";
          var isProp = isObject && this.prop in x;
          return this.parser(isProp ? x[this.prop] : x);
        };
  
    /**
     * Sorts an array of elements.
     *
     * @param {Array} array: the collection to sort
     * @param {Object} cfg: the configuration options
     * @property {String}   cfg.prop: property name (if it is an Array of objects)
     * @property {Boolean}  cfg.desc: determines whether the sort is descending
     * @property {Function} cfg.parser: function to parse the items to expected type
     * @return {Array}
     */
    return function sortby (array, cfg) {
      if (!(array instanceof Array && array.length)) return [];
      if (toString.call(cfg) !== "[object Object]") cfg = {};
      if (typeof cfg.parser !== "function") cfg.parser = parse;
      cfg.desc = !!cfg.desc ? -1 : 1;
      return array.sort(function (a, b) {
        a = getItem.call(cfg, a);
        b = getItem.call(cfg, b);
        return cfg.desc * (a < b ? -1 : +(a > b));
      });
    };
  
  }());

/**
 *  Retrieves this users notification history 
 *
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
module.exports.creatorHistory = function (req, res){
  var creatorHistoryItems = [];
  sequelize.query('CALL GetNotificationHistory(?)',
  { replacements: [ req.query.userId ],
      type: sequelize.QueryTypes.RAW }).then(result => {
          if(result.length > 0){
              for(var i = 0; i < result.length; i++){
                  var creatorHistoryItem = {
                      userProfilePic: result[i].creator_profile_pic,
                      userName: result[i].creator_name,
                      type: result[i].notification_type,
                      description: result[i].notification_description,
                      created: result[i].item_created,
                      postUUID: result[i].post_uuid,
                      postUrl: result[i].post_url
                  };
                  creatorHistoryItems.push(creatorHistoryItem);
              }
          }
          sequelize.query('CALL GetFollowNotificationHistory(?)',
          { replacements: [ req.query.userId ],
              type: sequelize.QueryTypes.RAW }).then(result => {
                  if(result.length > 0){
                      for(var j = 0; j < result.length; j++){
                          var creatorHistoryItem = {
                              userProfilePic: result[j].creator_profile_pic,
                              userName: result[j].creator_name,
                              type: result[j].notification_type,
                              description: result[j].notification_description,
                              created: result[j].item_created,
                              postUUID: result[j].post_uuid,
                              postUrl: result[j].post_url
                          };
                          creatorHistoryItems.push(creatorHistoryItem);
                      }
                  }
                  res.json(sortBy(creatorHistoryItems, { prop: "created", desc: true }));
          }).error(function(err){
              email.sendApiCreatorQErrorEmail(err);
              res.json(sortBy(creatorHistoryItems, { prop: "created", desc: true }));
          });
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      res.json(creatorHistoryItems);
  });
};

/**
 *  Retrieves all comments for this post 
 *
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
module.exports.creatorPostComments = function (req, res){
  var creatorPostCommentsArr = [];
  sequelize.query('CALL GetPostComments(?)',
  { replacements: [ req.query.postUUID ],
      type: sequelize.QueryTypes.RAW }).then(result => {
          if(result.length > 0){
              for(var i = 0; i < result.length; i++){
                  var creatorPostComment = {
                      _id: result[i].item_id,
                      postUUID: result[i].post_uuid,
                      creatorsName: result[i].creator_name,
                      userProfilePicUrl: result[i].creator_profile_pic,
                      comment: result[i].post_comment,
                      commentCreated: result[i].item_created
                  };
                  creatorPostCommentsArr.push(creatorPostComment);
              }
          }
          res.json(creatorPostCommentsArr);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      res.json(creatorPostCommentsArr);
  });
};

/**
 *  Retrieves all data for this creator
 *
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
module.exports.creatorContactProfile = function (req, res){
  var creatorPostsArr = [];
  var postUrls = [];
  sequelize.query('CALL GetCreatorProfile(?,?)',
  { replacements: [ req.query.creatorName, req.query.userId ],
      type: sequelize.QueryTypes.RAW }).then(result => {
          if(result.length > 0){
              var creator = {
                  creatorId: result[0].name,
                  statusMessage: result[0].creator_status_message,
                  profilePic: result[0].creator_profile_pic,
                  posts: result[0].creator_posts,
                  creatorFollowers: result[0].creator_total_followers,
                  creatorFollowing: result[0].creator_total_following,
                  creatorProfileViews: result[0].creator_profile_views,
                  creatorTotalLikes: result[0].creator_total_likes,
                  website: result[0].creator_website,
                  followingThisCreator: result[0].following_this_creator,
                  creatorPosts: []
              };
              if(result[0].post_uuid !== null){
                  for(var i = 0; i < result.length; i++){
                      var next = i+1;
                      if(result.length > next){
                          if(result[i].post_uuid === result[next].post_uuid){
                              postUrls.push(result[i].post_url);
                          }else{
                              postUrls.push(result[i].post_url);
                              var creatorPost = {
                                  uuid: result[i].post_uuid,
                                  creatorProfilePicUrl: result[0].creator_profile_pic,
                                  creatorsName: result[i].creator_name,
                                  postUrls: postUrls,
                                  postCaption: result[i].post_caption,
                                  postType: result[i].post_type,
                                  postText: result[i].post_text !== null ? result[i].post_text : result[i].post_type,
                                  likes: result[i].likes,
                                  comments: result[i].comments,
                                  postCreated: result[i].item_created,
                                  followingThisCreator: 0
                              };
                              creatorPostsArr.push(creatorPost);
                              postUrls = [];
                          }
                      }else{
                          postUrls.push(result[i].post_url);
                          var myCreatorPost = {
                              uuid: result[i].post_uuid,
                              creatorProfilePicUrl: result[0].creator_profile_pic,
                              creatorsName: result[i].creator_name,
                              postUrls: postUrls,
                              postCaption: result[i].post_caption,
                              postType: result[i].post_type,
                              postText: result[i].post_text !== null ? result[i].post_text : result[i].post_type,
                              likes: result[i].likes,
                              comments: result[i].comments,
                              postCreated: result[i].item_created,
                              followingThisCreator: 0
                          };
                          creatorPostsArr.push(myCreatorPost);
                          postUrls = [];
                      }
                  }
              }
              creator.creatorPosts = creatorPostsArr;
              res.json(creator);
          }else{
              res.json(null);
          } 
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      res.json(null);
  });
};

/**
 *  Retrieves all posts for this creator
 *
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
module.exports.creatorPosts = function (req, res){
  var creatorPostsArr = [];
  sequelize.query('CALL GetCreatorPosts(?)',
  { replacements: [ req.query.creatorsName ],
      type: sequelize.QueryTypes.RAW }).then(result => {
          if(result.length > 0){
              for(var i = 0; i < result.length; i++){
                  var next = i+1;
                  if(result.length > next){
                      if(result[i].post_uuid === result[next].post_uuid){
                          postUrls.push(result[i].post_url);
                      }else{
                          postUrls.push(result[i].post_url);
                          var creatorPost = {
                              uuid: result[i].post_uuid,
                              creatorProfilePicUrl: result[i].creator_profile_pic,
                              creatorsName: result[i].creator_name,
                              postUrls: postUrls,
                              postCaption: result[i].post_caption,
                              postType: result[i].post_type,
                              postText: result[i].post_text !== null ? result[i].post_text : result[i].post_type,
                              likes: result[i].likes,
                              comments: result[i].comments,
                              postCreated: result[i].item_created,
                              followingThisCreator: 0
                          };
                          creatorPostsArr.push(creatorPost);
                          postUrls = [];
                      }
                  }else{
                      postUrls.push(result[i].post_url);
                      var myCreatorPost = {
                          uuid: result[i].post_uuid,
                          creatorProfilePicUrl: result[i].creator_profile_pic,
                          creatorsName: result[i].creator_name,
                          postUrls: postUrls,
                          postCaption: result[i].post_caption,
                          postType: result[i].post_type,
                          postText: result[i].post_text !== null ? result[i].post_text : result[i].post_type,
                          likes: result[i].likes,
                          comments: result[i].comments,
                          postCreated: result[i].item_created,
                          followingThisCreator: 0
                      };
                      creatorPostsArr.push(myCreatorPost);
                      postUrls = [];
                  }
              }
          }
          res.json(creatorPostsArr);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      res.json(creatorPostsArr);
  });
};

/**
 *  Retrieves more posts for this creator
 *
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
module.exports.loadMorePosts = function (req, res){
  var creatorPostsArr = [];
  sequelize.query('CALL LoadMoreCreatorPosts(?,?)',
  { replacements: [ req.query.creatorsName, req.query.lastPostCreated ],
      type: sequelize.QueryTypes.RAW }).then(result => {
          if(result.length > 0){
              for(var i = 0; i < result.length; i++){
                  var next = i+1;
                  if(result.length > next){
                      if(result[i].post_uuid === result[next].post_uuid){
                          postUrls.push(result[i].post_url);
                      }else{
                          postUrls.push(result[i].post_url);
                          var creatorPost = {
                              uuid: result[i].post_uuid,
                              creatorProfilePicUrl: result[i].creator_profile_pic,
                              creatorsName: result[i].creator_name,
                              postUrls: postUrls,
                              postCaption: result[i].post_caption,
                              postType: result[i].post_type,
                              postText: result[i].post_text !== null ? result[i].post_text : result[i].post_type,
                              likes: result[i].likes,
                              comments: result[i].comments,
                              postCreated: result[i].item_created,
                              followingThisCreator: 0
                          };
                          creatorPostsArr.push(creatorPost);
                          postUrls = [];
                      }
                  }else{
                      postUrls.push(result[i].post_url);
                      var myCreatorPost = {
                          uuid: result[i].post_uuid,
                          creatorProfilePicUrl: result[i].creator_profile_pic,
                          creatorsName: result[i].creator_name,
                          postUrls: postUrls,
                          postCaption: result[i].post_caption,
                          postType: result[i].post_type,
                          postText: result[i].post_text !== null ? result[i].post_text : result[i].post_type,
                          likes: result[i].likes,
                          comments: result[i].comments,
                          postCreated: result[i].item_created,
                          followingThisCreator: 0
                      };
                      creatorPostsArr.push(myCreatorPost);
                      postUrls = [];
                  }
              }
          }
          res.json(creatorPostsArr);
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      res.json(creatorPostsArr);
  });
};

/**
 *  Retrieves all creators who this user follows
 *
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
module.exports.creatorFollows = function (req, res){
  var creatorFollowsArr = [];
  sequelize.query('CALL GetCreatorFollows(?)',
  { replacements: [ req.query.userId ],
      type: sequelize.QueryTypes.RAW }).then(result => {
          if(result.length > 0){
              for(var i = 0; i < result.length; i++){
                  var creator = {
                      creatorId: result[i].creator_name,
                      statusMessage: result[i].creator_status_message,
                      profilePic: result[i].creator_profile_pic,
                      posts: result[i].creator_posts,
                      creatorFollowers: 0,
                      creatorFollowing: 0,
                      creatorProfileViews: result[i].creator_profile_views,
                      creatorTotalLikes: result[i].creator_total_likes,
                      website: result[i].creator_website,
                      followingThisCreator: 1// this value is not displayed to the user
                  };
                  creatorFollowsArr.push(creator);
              }
              res.json(creatorFollowsArr);
          }else{
              res.json(creatorFollowsArr);
          }  
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      res.json(creatorFollowsArr);
  });
};

/**
 *  Retrieves all followers for this user 
 *
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
module.exports.creatorFollowers = function (req, res){
  var creatorFollowersArr = [];
  sequelize.query('CALL GetCreatorFollowers(?)',
  { replacements: [ req.query.creatorName ],
      type: sequelize.QueryTypes.RAW }).then(result => {
          if(result.length > 0){
              for(var i = 0; i < result.length; i++){
                  var creator = {
                      creatorId: result[i].creator_name,
                      statusMessage: result[i].creator_status_message,
                      profilePic: result[i].creator_profile_pic,
                      posts: result[i].creator_posts,
                      creatorFollowers: 0,
                      creatorFollowing: 0,
                      creatorProfileViews: result[i].creator_profile_views,
                      creatorTotalLikes: result[i].creator_total_likes,
                      website: result[i].creator_website,
                      followingThisCreator: 0// this value is not displayed to the user
                  };
                  creatorFollowersArr.push(creator);
              }
              res.json(creatorFollowersArr);
          }else{
              res.json(creatorFollowersArr);
          }  
  }).error(function(err){
      email.sendApiCreatorQErrorEmail(err);
      res.json(creatorFollowersArr);
  });
};



/**
 *  Stores creators video post
 *
 * (req Object): object that holds all the request information
 * (res Object): object that is used to send user response
 */
module.exports.saveCreatorVideoPost = function (message, amqpConn, topic){
    sequelize.query('CALL ProcessNewCreatorPost(?,?,?,?,?,?,?,?,?,?,?)',
    { replacements: [ message.postUUID, message.userName, message.postCapture, message.postType, message.likes, message.comments, message.createdAt,
        message.lastUpdatedAt, message.type, message.notificationMessage, message.postUrl ],
        type: sequelize.QueryTypes.RAW }).then(result => {
            var response = {
                status: config.rabbitmq.statuses.ok
            };
            publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
    }).error(function(err){
        email.sendApiCreatorQErrorEmail(err);
        var response = {
            status: config.rabbitmq.statuses.error
        };
        publishToApiCreatorC(JSON.stringify(response), amqpConn, topic);
    });
};