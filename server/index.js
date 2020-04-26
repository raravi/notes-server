const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const express = require('express');
const mongooseConnection = require('./db');

const app = express();

const users = require("../routes/api/users");

// Config from Environment variables
let keys = {};
keys.sessionSecret = process.env.APP_SESSIONSECRET;
keys.clientUrl = process.env.APP_CLIENTURL;

// Enable CORS
app.use(cors({
  origin:['http://localhost:3000', keys.clientUrl],
  methods:['GET','POST'],
  credentials: true // enable set cookie (needed for AXIOS frontend requests)
}));

//app.options('*', cors());

// app.use(function(req, res, next) {
//   res.header('Access-Control-Allow-Origin', keys.clientUrl);
//   res.header('Access-Control-Allow-Credentials', true);
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
//   next();
// });

// Rate Limiter Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
});
//  apply limiter to all requests
app.use(limiter);

// Bodyparser middleware
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// Session Middleware
app.use(session({
  secret: keys.sessionSecret,
  saveUninitialized: false, // don't create session until something stored
  resave: false, //don't save session if unmodified
  store: new MongoStore({ mongooseConnection: mongooseConnection })
}));

// Routes
app.use("/api/users", users);

module.exports = app;
