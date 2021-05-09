const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const helmet = require('helmet')
const cors = require("cors");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const users = require("./routes/api/users");

// Config from Environment variables
const keys = {};
keys.sessionSecret = process.env.APP_SESSIONSECRET;
keys.clientUrl = process.env.APP_CLIENTURL;
keys.db = process.env.APP_DB;

app.use(helmet());

// Enable CORS
app.use(
  cors({
    origin: [/*'http://localhost:3000',*/ keys.clientUrl],
    methods: ["GET", "POST"],
    credentials: true, // enable set cookie (needed for AXIOS frontend requests)
  })
);

// Rate Limiter Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
});
app.use(limiter);

// Body parser middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Connect to Mongo DB using Mongoose
mongoose.connect(keys.db, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});
mongoose.connection.on("error", () =>
  console.error.bind(console, "connection error")
);
mongoose.connection.once("open", () => {
  console.log("MongoDB successfully connected");
  // Session Middleware
  app.use(
    session({
      secret: keys.sessionSecret,
      saveUninitialized: false, // don't create session until something stored
      resave: false, //don't save session if unmodified
      store: new MongoStore({ client: mongoose.connection.client }),
    })
  );
});

// Routes
app.use("/api/users", users);

module.exports = app;
