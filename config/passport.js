const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const User = require("../models/User");

let keys;
if (!process.env.CI_ENVIRONMENT) {
  keys = require("./keys");
} else {
  keys = {};
  keys.secretOrKey = process.env.CI_ENVIRONMENT_SECRETORKEY;
}

var opts = {};

opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = keys.secretOrKey;

/**
 * Passport JWT Strategy for User Authentication
 */
module.exports = passport => {
  passport.use(new JwtStrategy(opts, function(jwt_payload, done) {
    User.findOne({id: jwt_payload.sub}, function(err, user) {
      if (err) {
          return done(err, false);
      }
      if (user) {
          return done(null, user);
      } else {
          return done(null, false);
          // or you could create a new account
      }
    });
  }));
};
