const passport = require("passport");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const express = require('express');
const mongooseConnection = require('./db');

const app = express();
const port = 8000;

const users = require("../routes/api/users");

let keys;
if (!process.env.CI_ENVIRONMENT) {
  keys = require("../config/keys");
} else {
  keys = {};
  keys.sessionSecret = process.env.CI_ENVIRONMENT_SESSIONSECRET;
}

// Enable CORS
app.use(cors({
  origin:['http://localhost:3000'],
  methods:['GET','POST'],
  credentials: true // enable set cookie (needed for AXIOS frontend requests)
}));

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

// Passport middleware
app.use(passport.initialize());
require("../config/passport")(passport);

// Session Middleware
app.use(session({
  secret: keys.sessionSecret,
  saveUninitialized: false, // don't create session until something stored
  resave: false, //don't save session if unmodified
  store: new MongoStore({ mongooseConnection: mongooseConnection })
}));

// Routes
app.use("/api/users", users);

// Reset Password
app.get('/resetpassword', function(req, res) {
    res.sendFile(path.join(__dirname, '../', '/resetpassword/index.html'));
});

module.exports = app;
