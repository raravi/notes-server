const express = require("express");
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const keys = require("../../config/keys");

/**
 * Load input validation
 */
const validateRegisterInput = require("../../validation/register");
const validateLoginInput = require("../../validation/login");
const validateForgotPasswordInput = require("../../validation/forgotpassword");
const validateResetPasswordInput = require("../../validation/resetpassword");

/**
 * Load User model
 */
const User = require("../../models/User");

/**
 * @route POST api/users/register
 * @desc Register user
 * @access Public
 */
router.post("/register", (req, res) => {
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
          if (err) throw err;
          newUser.password = hash;
          newUser
            .save()
            .then(user => res.json({createduser: "New user registered successfully!"}))
            .catch(err => console.log(err));
        });
      });
    }
  });
});

/**
 * @route POST api/users/login
 * @desc Login user and return JWT token
 * @access Public
 */
router.post("/login", (req, res) => {
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
            res.json({
              success: true,
              token: "Bearer " + token
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
});

/**
 * @route FORGOTPASSWORD api/users/forgotpassword
 * @desc Get valid email from user and send a RESET mail to the registered email.
 * @access Public
 */
router.post("/forgotpassword", (req, res) => {
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
        if (err) throw err;
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
            from: 'texter-app@gmail.com',
            to: `${user.email}`,
            subject: 'Link To Reset Password',
            text:
              'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n'
              + 'Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n'
              + `http://localhost:8000/resetpassword\n\n`
              + `Reset Code: ${randomString}\n\n`
              + 'If you did not request this, please ignore this email and your password will remain unchanged.\n',
          };

          console.log('sending email...');

          // Send mail
          transporter.sendMail(mailOptions, (err, response) => {
            if (err) {
              console.error('there was an error: ', err);
            } else {
              console.log('here is the response: ', response);
              res.status(200).json({emailsent: 'The reset email has been sent, please check your inbox!'});
            }
          });
        });
      });
    });
  });
});

/**
 * @route RESETPASSWORD api/users/resetpassword
 * @desc Get valid RESET code, new password from user and update the password in DB.
 * @access Public
 */
router.post("/resetpassword", (req, res) => {
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
            if (err) throw err;
            user.password = hash;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            // save the user to DB
            user.save()
              .then(user => {
                return res.json({success: "Password changed successfully!"});
              })
              .catch(err => console.log(err));
          });
        });
      } else {
        return res
          .status(400)
          .json({ resetcode: "Reset code is invalid" });
      }
    });

  });
});

module.exports = router;
