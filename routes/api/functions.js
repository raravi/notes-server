require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

let keys;
if (!process.env.CI_ENVIRONMENT) {
  // keys = require("../../config/keys");
  keys = {};
  keys.secretOrKey = process.env.BUILD_ENVIRONMENT_SECRETORKEY;
  keys.email = process.env.BUILD_ENVIRONMENT_EMAIL;
  keys.password = process.env.BUILD_ENVIRONMENT_PASSWORD;
} else {
  keys = {};
  keys.secretOrKey = process.env.CI_ENVIRONMENT_SECRETORKEY;
  keys.email = process.env.CI_ENVIRONMENT_EMAIL;
  keys.password = process.env.CI_ENVIRONMENT_PASSWORD;
}

/**
 * Load input validation
 */
const validateRegisterInput = require("../../validation/register");
const validateLoginInput = require("../../validation/login");
const validateForgotPasswordInput = require("../../validation/forgotpassword");
const validateResetPasswordInput = require("../../validation/resetpassword");

/**
 * Load User / Note models
 */
const User = require("../../models/User");
const Note = require("../../models/Note");

/**
 * This function handles registering of new users.
 * Checks if all the details are correct, then writes it
 * to the DB and responds to the user. If the details are
 * wrong, throws relevant errors.
 */
const register = (req, res) => {
  // Form validation
  const { errors, isValid } = validateRegisterInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  User.findOne({ email: req.body.email }).then(user => {
    if (user) {
      return res.status(400).json({ email: "Email already exists" });
    } else {
      const newUser = new User({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password
      });
      // Hash password before saving in database
      // The top result on Google, the tutorial from scotch.io, also uses bcrypt with a lesser cost factor of 8. Both of these are small, but 8 is really small. Most bcrypt libraries these days use 12. The cost factor of 8 was for administrator accounts eighteen years ago when the original bcrypt paper was released.
      bcrypt.genSalt(12, (err, salt) => {
        bcrypt.hash(newUser.password, salt, (err, hash) => {
          if (err) {
            console.error('bcrypt hashing error: ', err);
            return res.status(404).json({email: "There was a problem, please try again!"});
          }
          newUser.password = hash;
          newUser
            .save()
            .then(user => res.json({createduser: "New user registered successfully!"}))
            .catch(err => {
              console.log('MongoDB new user save error: ', err);
              res.status(404).json({email: "There was a problem, please try again!"});
            });
        });
      });
    }
  });
};

/**
 * This function handles login of the user. Checks if all the
 * details are correct, then responds to the user with a token.
 * If the details are wrong, throws relevant errors.
 */
const login = (req, res) => {
  // Form validation
  const { errors, isValid } = validateLoginInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const email = req.body.email;
  const password = req.body.password;
  // Find user by email
  User.findOne({ email }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ email: "Email not found" });
    }
    // Check password
    bcrypt.compare(password, user.password).then(isMatch => {
      if (isMatch) {
        // User matched
        // Create JWT Payload
        const payload = {
          id: user.id,
          name: user.name
        };
        // Sign token
        // JWT is not encrypted!
        jwt.sign(
          payload,
          keys.secretOrKey,
          {
            expiresIn: 31556926 // 1 year in seconds
          },
          (err, token) => {
            req.session.token = token;
            Note.find({userid: user.id}, {}, { sort: { _id: 1 }, limit: 50 }).then(docs => {
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
                token: "Bearer " + token,
                notes: notes
              });
            });
          }
        );
      } else {
        return res
          .status(400)
          .json({ password: "Password incorrect" });
      }
    });
  });
};

/**
 * This function handles "Forgot Password" of the user. Checks if the
 * email address is correct, then sends an email to the user with a token.
 * If the details are wrong, throws relevant errors.
 */
const forgotPassword = (req, res) => {
  // Form validation
  const { errors, isValid } = validateForgotPasswordInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const email = req.body.email;
  // Find user by email
  User.findOne({ email }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ email: "Email not found" });
    }

    // Generate random string
    const randomString = crypto.randomBytes(16).toString('hex');
    user.resetPasswordToken = randomString.toString();
    user.resetPasswordExpires = new Date(Date.now() + 3600000);

    // hash the Reset token
    bcrypt.genSalt(12, (err, salt) => {
      bcrypt.hash(user.resetPasswordToken, salt, (err, hash) => {
        if (err) {
          console.error('bcrypt hashing error: ', err);
          return res.status(404).json({email: "The reset email couldn't be sent, please try again!"});
        }
        user.resetPasswordToken = hash;

        // Save the user to DB
        user.save().then((user) => {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: keys.email,
              pass: keys.password,
            },
          });

          const mailOptions = {
            from: 'notes-app@gmail.com',
            to: `${user.email}`,
            subject: 'Link To Reset Password',
            text:
              'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n'
              + 'Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n'
              + `http://localhost:8000/resetpassword\n\n`
              + `Reset Code: ${randomString}\n\n`
              + 'If you did not request this, please ignore this email and your password will remain unchanged.\n',
          };

          // Send mail
          transporter.sendMail(mailOptions)
            .then(response => {
              console.log('sendMail success: ', response);
              res.status(200).json({emailsent: 'The reset email has been sent, please check your inbox!'});
            })
            .catch(err => {
              console.error('sendMail error: ', err);
              res.status(404).json({email: "The reset email couldn't be sent, please try again!"});
            });
        });
      });
    });
  });
};

/**
 * This function handles "Reset Password" of the user. Checks if the
 * details provided are correct, then resets the password of the user.
 * If the details are wrong, throws relevant errors.
 */
const resetPassword = (req, res) => {
  // Form validation
  const { errors, isValid } = validateResetPasswordInput(req.body);
  // Check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const email = req.body.email;
  const resetCode = req.body.resetcode;
  const newPassword = req.body.password;
  // Find user by email
  User.findOne({ email: email }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ email: "Email not found" });
    }

    // Check RESET code
    bcrypt.compare(resetCode, user.resetPasswordToken).then(isMatch => {
      if (isMatch) {
        // Token matched
        if (user.resetPasswordExpires < Date.now()) {
          user.resetPasswordToken = undefined;
          user.resetPasswordExpires = undefined;
          user.save();

          return res.status(400).json({ resetcode: "Reset code has expired" });
        }

        // hash the new password
        bcrypt.genSalt(12, (err, salt) => {
          bcrypt.hash(newPassword, salt, (err, hash) => {
            if (err) {
              console.error("bcrypt hashing error: ", err);
              return res.status(404).json({resetcode: "Password couldn't be changed, please try again!"});
            }
            user.password = hash;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            // save the user to DB
            user.save()
              .then(user => {
                return res.json({success: "Password changed successfully!"});
              })
              .catch(err => {
                console.log("MongoDB save password error: ", err);
                return res.status(400).json({resetcode: "Password couldn't be changed, please try again!"});
              });
          });
        });
      } else {
        return res
          .status(400)
          .json({ resetcode: "Reset code is invalid" });
      }
    });
  });
};

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

module.exports = {  login,
                    register,
                    forgotPassword,
                    resetPassword,
                    logout,
                    syncNote,
                    sendAllNotes,
                    newNote,
                    deleteNote };
