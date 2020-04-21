const express = require("express");
const router = express.Router();
const passport = require("passport");
const { login,
        register,
        forgotPassword,
        resetPassword,
        logout,
        syncNote,
        initialSync,
        sendAllNotes,
        newNote,
        deleteNote } = require("./functions");

// Passport middleware
router.use(passport.initialize());
require("../../config/passport")(passport);

/**
 * @route POST api/users/register
 * @desc Register user
 * @access Public
 */
router.post("/register", register);

/**
 * @route POST api/users/login
 * @desc Login user and return JWT token
 * @access Public
 */
router.post("/login", login);

/**
 * @route POST api/users/forgotpassword
 * @desc Get valid email from user and send a RESET mail to the registered email.
 * @access Public
 */
router.post("/forgotpassword", forgotPassword);

/**
 * @route POST api/users/resetpassword
 * @desc Get valid RESET code, new password from user and update the password in DB.
 * @access Public
 */
router.post("/resetpassword", resetPassword);

/**
 * @route POST api/users/logout
 * @desc Destroy the session upon logout.
 * @access Public
 */
router.post("/logout",
            passport.authenticate('jwt', { session: false }),
            logout);

/**
 * @route POST api/users/sync
 * @desc Sync the note to DB.
 * @access Public
 */
router.post("/sync",
            passport.authenticate('jwt', { session: false }),
            syncNote);

/**
 * @route POST api/users/initialsync
 * @desc Send all the notes from DB & set synceddate.
 * @access Public
 */
router.post("/initialsync",
            passport.authenticate('jwt', { session: false }),
            initialSync);

/**
 * @route POST api/users/sendall
 * @desc Send all the notes from DB.
 * @access Public
 */
router.post("/sendall",
            passport.authenticate('jwt', { session: false }),
            sendAllNotes);

/**
 * @route POST api/users/new
 * @desc New note is saved to DB.
 * @access Public
 */
router.post("/new",
            passport.authenticate('jwt', { session: false }),
            newNote);

/**
 * @route POST api/users/delete
 * @desc Delete the selected note from DB.
 * @access Public
 */
router.post("/delete",
            passport.authenticate('jwt', { session: false }),
            deleteNote);

module.exports = router;
