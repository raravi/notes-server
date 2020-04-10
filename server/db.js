require('dotenv').config();
const mongoose = require("mongoose");

// Config from Environment variables
let db = process.env.NOTESAPP_MONGOURI;

// Connect to MongoDB

// mongoose
//   .connect(db, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     useFindAndModify: false
//   })
//   .then(() => console.log("MongoDB successfully connected"))
//   .catch(err => console.log("MongoDB Error: ", err));

mongoose.connect(db, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
});
mongoose.connection.on('error', console.error.bind(console, 'connection error'));
mongoose.connection.once('open', function() {
  console.log('MongoDB successfully connected');
});

module.exports = mongoose.connection;
