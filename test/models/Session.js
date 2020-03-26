const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Session Schema for MongoDB
 */
const SessionSchema = new Schema({
  _id: {
    type: String
  },
  expires: {
    type: Date,
    required: true
  },
  session: {
    type: String,
    required: true
  }
});

/**
 * This schema targets the 'sessions' collection in MongoDB.
 */
module.exports = Session = mongoose.model("sessions", SessionSchema);
