// Config from Environment variables
let keys = {};
keys.secretOrKey = process.env.APP_SECRETORKEY;
keys.email = process.env.APP_EMAIL;
keys.password = process.env.APP_PASSWORD;

/**
 * Load Note model
 */
const Note = require("../../models/Note");

/**
 * This function handles "logout" of the user.
 * If there was an issue, throws relevant errors.
 */
const logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.log("session destroy error: ", err);
      return res.status(400).json({ logoff: "There was an error, please try again!" });
    }
    else {
      return res.status(200).json({ logoff: "Logged off" });
    }
  });
};

/**
 * This function handles syncing of the current note for the user.
 * Checks if the note has been edited, and syncs it with the DB.
 * If the details are wrong, throws relevant errors.
 */
const syncNote = (req, res) => {
  Note.findById(req.body.noteid).then(note => {
    // Check if note exists
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }
    if (note.userid === req.body.userid) {
      let modifiedDateOfNote = req.session[req.body.noteid] === undefined
                              ? req.session.synceddate
                              : req.session[req.body.noteid];

      if (note.modifiedsession !== req.session.id && note.modifieddate > modifiedDateOfNote) {
        req.session[req.body.noteid] = note.modifieddate.getTime();
        return res.json({
          notemodified: "Note modified by another session",
          note: note.note,
          modifieddate: note.modifieddate
        });
      }

      if (!req.body.notetext) {
        return res.json({nochanges: "No changes"});
      } else {
        note.note = req.body.notetext;
        note.modifieddate = Date.now();
        note.modifiedsession = req.session.id;

        // update the note in DB
        note.save()
          .then(note => {
            return res.json({
              success: "Note updated!",
              modifieddate: note.modifieddate
            });
          })
          .catch(err => {
            console.log("MongoDB save note error: ", err);
            return res.status(400).json({
              error: "There was an error, note couldn't be updated!"
            });
          });
      }
    } else {
      console.log("Error: there is a mismatch in userid!");
      return res.status(404).json({ error: "Sync error" });
    }
  });
};

/**
 * This function handles initial syncing of the user session.
 * It creates synceddate, and sends all notes to the user.
 * If the details are wrong, throws relevant errors.
 */
const initialSync = (req, res) => {
  Note.find({userid: req.body.userid}, {}, { sort: { _id: 1 }, limit: 50 }).then(docs => {
    let notes = [];
    req.session.synceddate = Date.now();
    docs.forEach(doc =>
      notes.push({
        id: doc.id,
        note: doc.note,
        modifieddate: doc.modifieddate
      })
    );
    res.json({
      success: true,
      notes: notes
    });
  });
};

/**
 * This function handles syncing of all notes of the user.
 * If the details are wrong, throws relevant errors.
 */
const sendAllNotes = (req, res) => {
  Note.find({userid: req.body.userid}, {}, { sort: { _id: 1 }, limit: 50 }).then(docs => {
    let notes = [];

    docs.forEach(doc =>
      notes.push({
        id: doc.id,
        note: doc.note,
        modifieddate: doc.modifieddate
      })
    );
    res.json({
      success: true,
      notes: notes
    });
  });
};

/**
 * This function handles creating a new note of the user.
 * If there is an issue, throws relevant errors.
 */
const newNote = (req, res) => {
  let date = Date.now();
  const newNote = new Note({
            userid: req.body.userid,
            note: "# An awesome new note",
            modifiedsession: req.session.id
          });
  newNote
    .save()
    .then(note => {
      return res.json({
        note: {
          id: note.id,
          note: note.note,
          modifieddate: note.modifieddate,
          createddate: note.createddate
        }
      });
    })
    .catch(err => {
      console.log(err);
      return res.status(400).json({error: "Adding to DB failed!"});
    });
};

/**
 * This function handles deleting a note of the user.
 * If there is an issue, throws relevant errors.
 */
const deleteNote = (req, res) => {
  Note.findByIdAndRemove(req.body.noteid).then(() => {
    return res.json({success: "Note deleted!"});
  })
  .catch(err => {
    console.log("MongoDB delete note error: ", err);
    return res.status(400).json({error: "Delete failed!"});
  });
};

module.exports = {  logout,
                    syncNote,
                    initialSync,
                    sendAllNotes,
                    newNote,
                    deleteNote };
