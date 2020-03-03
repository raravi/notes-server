const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * User Schema for MongoDB
 */
const UserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  }
});

/**
 * This schema targets the 'users' collection in MongoDB.
 */
module.exports = User = mongoose.model("users", UserSchema);
