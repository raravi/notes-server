const passport = require("passport");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const express = require('express');

const app = express();
const port = 8000;

const users = require("./routes/api/users");
const keys = require("./config/keys");
const db = keys.mongoURI;

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
require("./config/passport")(passport);

// Connect to MongoDB
mongoose
  .connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB successfully connected"))
  .catch(err => console.log(err));

app.use(session({
  secret: keys.sessionSecret,
  saveUninitialized: false, // don't create session until something stored
  resave: false, //don't save session if unmodified
  store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

// Start server
const server = require('http').Server(app);
server.listen(port);

// Routes
app.use("/api/users", users);

// Reset Password
app.get('/resetpassword', function(req, res) {
    res.sendFile(path.join(__dirname + '/resetpassword/index.html'));
});

console.log('Listening on port ', port);
