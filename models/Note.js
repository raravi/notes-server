const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Note Schema for MongoDB
 */
const NoteSchema = new Schema({
  userid: {
    type: String,
    required: true
  },
  note: {
    type: String,
    required: true
  },
  modifieddate: {
    type: Date,
    required: true
  },
  createddate: {
    type: Date,
    default: Date.now
  },
  modifiedsession: {
    type: String
  }
});

/**
 * This schema targets the 'notes' collection in MongoDB.
 */
module.exports = Note = mongoose.model("notes", NoteSchema);
