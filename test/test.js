const request = require('supertest');
const app = require('../server');
const expect = require('chai').expect;
const sinon = require('sinon');
const mongoose = require("mongoose");
const jwtDecode = require('jwt-decode');
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const session = require('express-session');
const { resetPassword, logout, syncNote } = require("../routes/api/functions");

const User = require("../models/User");
const Note = require("../models/Note");
const Session = require("./models/Session");

let register = {
      api: '/api/users/register',
      json: null,
      success: 'New user registered successfully!',
      error: 'There was a problem, please try again!'
    },
    login = {
      api: '/api/users/login',
      json: null
    },
    forgotPassword = {
      api: '/api/users/forgotPassword',
      json: null,
      resolve: {email: "amith.raravi@gmail.com"},
      emailSuccess: 'The reset email has been sent, please check your inbox!',
      emailError: "The reset email couldn't be sent, please try again!"
    };

function deleteSession(token) {
  Session.find({}, {}, { sort: { _id: 1 }}).then((sessions) => {
    let sessionId;
    for (let i = 0; i < sessions.length; i++) {
      let sessionData = JSON.parse(sessions[i].session);
      if (sessionData.token === token) {
        sessionId = sessions[i].id;
        break;
      }
    }
    if (sessionId) {
      Session.findByIdAndRemove(sessionId).then((session) => {
        if (session)
          console.log("    Session deleted!");
        else
          console.log("    Session not deleted!");
      })
      .catch(err => {
        console.log("    Delete failed!");
      });
    } else {
      console.log("    Couldn't find session to delete!");
    }
  });
}

before(function() {
  console.log("  before");
});

after(function() {
  mongoose.disconnect();
  console.log("  after: disconnected DB");
});

describe('POST /register', function() {
  beforeEach(function() {
    register.json = {
      "name": "Amith Raravi",
      "email": "amith.raravi1@gmail.com",
      "password": "DmNcMZKa488WiBy",
      "password2": "DmNcMZKa488WiBy"
    };
  });

  it('success: new user registered successfully', function() {
    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.createduser).to.equal(register.success);
        User.findOneAndRemove({email: 'amith.raravi1@gmail.com'}).then(() => {
          console.log("    User deleted!");
        })
        .catch(err => {
          console.log("    User delete failed!", err);
        });
      });
  });

  it('error: bcrypt hashing error', function() {
    const bcryptHash = sinon.stub(bcrypt, 'hash');
    bcryptHash.callsFake((p1, p2, cb) => cb("Error"));

    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(register.error);
        bcrypt.hash.restore();
      });
  });

  it('error: User.save error', function() {
    const userSave = sinon.stub(User.prototype, 'save');
    userSave.rejects({error: "Error"});

    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(register.error);
        User.prototype.save.restore();
      });
  });

  it('error: email already exists', function() {
    register.json["email"] = "amith.raravi@gmail.com";
    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email already exists');
      });
  });

  it('validation error: name field is required', function() {
    register.json["name"] = "";
    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.name).to.equal('Name field is required');
      });
  });

  it('validation error: email field is required', function() {
    register.json["email"] = "";
    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email field is required');
      });
  });

  it('validation error: email is invalid', function() {
    register.json["email"] = "amith.raravi1gmail.com";
    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email is invalid');
      });
  });

  it('validation error: password field is required', function() {
    register.json["password"] = "";
    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal('Password field is required');
      });
  });

  it('validation error: password must be at least 6 characters', function() {
    register.json["password"] = "DmN";
    register.json["password2"] = "DmN";
    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal('Password must be at least 6 characters');
      });
  });

  it('validation error: password2 field is required', function() {
    register.json["password2"] = "";
    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password2).to.equal('Confirm password field is required');
      });
  });

  it('validation error: passwords must match', function() {
    register.json["password2"] = "DmNcMZ";
    return request(app)
      .post(register.api)
      .send(register.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password2).to.equal('Passwords must match');
      });
  });
});

describe('POST /login', function() {
  beforeEach(function() {
    login.json = {
      "email": "amith.raravi@gmail.com",
      "password": "DmNcMZKa488WiBy",
    };
  });

  it('success: responds with json', function() {
    return request(app)
      .post(login.api)
      .send(login.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        let token = response.body.token.slice(7);
        let tokenDecoded = jwtDecode(response.body.token);
        expect(response.body.success).to.equal(true);
        expect(tokenDecoded.name).to.equal('Amith Raravi');
        // Delete session
        deleteSession(token);
      });
  });

  it('error: email not found', function() {
    login.json["email"] = "amith.raravi@gmail.co";
    return request(app)
      .post(login.api)
      .send(login.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal('Email not found');
      });
  });

  it('error: password incorrect', function() {
    login.json["password"] = "DmNcMZKa488WiB";
    return request(app)
      .post(login.api)
      .send(login.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal('Password incorrect');
      });
  });

  it('validation error: email is empty', function() {
    login.json["email"] = "";
    return request(app)
      .post(login.api)
      .send(login.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email field is required');
      });
  });

  it('validation error: email is invalid', function() {
    login.json["email"] = "amith.raravigmail.com";
    return request(app)
      .post(login.api)
      .send(login.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email is invalid');
      });
  });

  it('validation error: password is empty', function() {
    login.json["password"] = "";
    return request(app)
      .post(login.api)
      .send(login.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal('Password field is required');
      });
  });
});

describe('POST /forgotpassword', function() {
  beforeEach(function() {
    forgotPassword.json = {
      "email": "amith.raravi@gmail.com"
    };
  });

  it('success: responds with email', function() {
    this.timeout(5000);
    const userSave = sinon.stub(User.prototype, 'save');
    userSave.resolves(forgotPassword.resolve);
    // Without this stub, mail is sent every time!
    const transporter = sinon.stub(nodemailer, 'createTransport');
    transporter.returns({
      sendMail: (mailOptions) => Promise.resolve({
        accepted: [ 'amith.raravi@gmail.com' ],
        rejected: [],
        envelopeTime: 218,
        messageTime: 1326,
        messageSize: 722,
        response: '250 2.0.0 OK  1585181557 z16sm901791wrr.56 - gsmtp',
        envelope: { from: 'notes-app@gmail.com', to: [ 'amith.raravi@gmail.com' ] },
        messageId: '<2eb7d96b-e5d9-9b2d-8a3a-1d1bd1301fe6@gmail.com>'
      })
    });

    return request(app)
      .post(forgotPassword.api)
      .send(forgotPassword.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.emailsent).to.equal(forgotPassword.emailSuccess);
        nodemailer.createTransport.restore();
        User.prototype.save.restore();
      });
  });

  it('error: email sending failed', function() {
    this.timeout(5000);
    const userSave = sinon.stub(User.prototype, 'save');
    userSave.resolves(forgotPassword.resolve);
    // Without this stub, mail is sent every time!
    const transporter = sinon.stub(nodemailer, 'createTransport');
    transporter.returns({
      sendMail: (mailOptions) => Promise.reject({
        error: "Email couldn't be sent"
      })
    });

    return request(app)
      .post(forgotPassword.api)
      .send(forgotPassword.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(forgotPassword.emailError);
        nodemailer.createTransport.restore();
        User.prototype.save.restore();
      });
  });

  it('error: bcrypt hashing failed', function() {
    this.timeout(5000);
    const bcryptHash = sinon.stub(bcrypt, 'hash');
    bcryptHash.callsFake((p1, p2, cb) => cb("Error"));

    return request(app)
      .post(forgotPassword.api)
      .send(forgotPassword.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(forgotPassword.emailError);
        bcrypt.hash.restore();
      });
  });

  it('error: email not found', function() {
    forgotPassword.json["email"] = "amith.raravi1@gmail.com";
    return request(app)
      .post(forgotPassword.api)
      .send(forgotPassword.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal('Email not found');
      });
  });

  it('validation error: email field is required', function() {
    forgotPassword.json["email"] = "";
    return request(app)
      .post(forgotPassword.api)
      .send(forgotPassword.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email field is required');
      });
  });

  it('validation error: email is invalid', function() {
    forgotPassword.json["email"] = "amith.raravigmail.com";
    return request(app)
      .post(forgotPassword.api)
      .send(forgotPassword.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email is invalid');
      });
  });
});

describe('POST /resetpassword', function() {
  it('success: password changed successfully', function() {
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves({
      _id: '5e5edca43aa9dc587503e1b4',
      name: 'Amith Raravi',
      email: 'amith.raravi@gmail.com',
      password: '$2a$12$.TdDUPO04ICoSdHmVy90x.rBptpYykbAFd4bTqxrEuutJQR2zjV5K',
      date: new Date('2020-03-03T22:39:32.371Z'),
      __v: 0,
      resetPasswordExpires: new Date('2220-03-26T03:26:04.136Z'),
      resetPasswordToken: '$2a$12$5z5/4rfoZHi7y4nrtvtHzuWgA8d9UnCLQpydhHLvm3hS.gpo9akkW',
      save: () => {
        return Promise.resolve({
          _id: '5e5edca43aa9dc587503e1b4',
          name: 'Amith Raravi',
          email: 'amith.raravi@gmail.com',
          password: '$2a$12$.TdDUPO04ICoSdHmVy90x.rBptpYykbAFd4bTqxrEuutJQR2zjV5K',
          date: new Date('2020-03-03T22:39:32.371Z'),
          __v: 0,
          resetPasswordExpires: new Date('2220-03-26T03:26:04.136Z'),
          resetPasswordToken: '$2a$12$5z5/4rfoZHi7y4nrtvtHzuWgA8d9UnCLQpydhHLvm3hS.gpo9akkW'
        })
      }
    });

    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.com",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "DmNcMZKa488WiBy",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.success).to.equal('Password changed successfully!');
        User.findOne.restore();
      });
  });

  it('error: bcrypt hashing error', function() {
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves({
      _id: '5e5edca43aa9dc587503e1b4',
      name: 'Amith Raravi',
      email: 'amith.raravi@gmail.com',
      password: '$2a$12$.TdDUPO04ICoSdHmVy90x.rBptpYykbAFd4bTqxrEuutJQR2zjV5K',
      date: new Date('2020-03-03T22:39:32.371Z'),
      __v: 0,
      resetPasswordExpires: new Date('2220-03-26T03:26:04.136Z'),
      resetPasswordToken: '$2a$12$5z5/4rfoZHi7y4nrtvtHzuWgA8d9UnCLQpydhHLvm3hS.gpo9akkW'
    });

    const bcryptCompare = sinon.stub(bcrypt, 'compare');
    bcryptCompare.resolves(true);

    const bcryptHash = sinon.stub(bcrypt, 'hash');
    bcryptHash.callsFake((p1, p2, cb) => cb("Error"));

    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.com",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "DmNcMZKa488WiBy",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.resetcode).to.equal("Password couldn't be changed, please try again!");
        bcrypt.hash.restore();
        bcrypt.compare.restore();
        User.findOne.restore();
      });
  });

  it('error: password saving to DB failed', function() {
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves({
      _id: '5e5edca43aa9dc587503e1b4',
      name: 'Amith Raravi',
      email: 'amith.raravi@gmail.com',
      password: '$2a$12$.TdDUPO04ICoSdHmVy90x.rBptpYykbAFd4bTqxrEuutJQR2zjV5K',
      date: new Date('2020-03-03T22:39:32.371Z'),
      __v: 0,
      resetPasswordExpires: new Date('2220-03-26T03:26:04.136Z'),
      resetPasswordToken: '$2a$12$5z5/4rfoZHi7y4nrtvtHzuWgA8d9UnCLQpydhHLvm3hS.gpo9akkW',
      save: () => {
        return Promise.reject({error: "Error"})
      }
    });

    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.com",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "DmNcMZKa488WiBy",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.resetcode).to.equal("Password couldn't be changed, please try again!");
        User.findOne.restore();
      });
  });

  it('error: email not found', function() {
    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.co",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "DmNcMZKa488WiBy",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal('Email not found');
      });
  });

  it('error: reset code has expired', function() {
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves({
      _id: '5e5edca43aa9dc587503e1b4',
      name: 'Amith Raravi',
      email: 'amith.raravi@gmail.com',
      password: '$2a$12$.TdDUPO04ICoSdHmVy90x.rBptpYykbAFd4bTqxrEuutJQR2zjV5K',
      date: new Date('2020-03-03T22:39:32.371Z'),
      __v: 0,
      resetPasswordExpires: new Date('2020-03-26T03:26:04.136Z'),
      resetPasswordToken: '$2a$12$5z5/4rfoZHi7y4nrtvtHzuWgA8d9UnCLQpydhHLvm3hS.gpo9akkW',
      save: () => {}
    });

    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.com",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "DmNcMZKa488WiBy",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {console.log(response.body);
        expect(response.body.resetcode).to.equal('Reset code has expired');
        User.findOne.restore();
      });
  });

  it('error: reset code is invalid', function() {
    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.com",
        "resetcode": "8c4e65",
        "password": "DmNcMZKa488WiBy",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.resetcode).to.equal('Reset code is invalid');
      });
  });

  it('validation error: email field is required', function() {
    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "DmNcMZKa488WiBy",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email field is required');
      });
  });

  it('validation error: email is invalid', function() {
    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravigmail.com",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "DmNcMZKa488WiBy",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email is invalid');
      });
  });

  it('validation error: reset code is required', function() {
    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.com",
        "resetcode": "",
        "password": "DmNcMZKa488WiBy",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.resetcode).to.equal('Reset code is required');
      });
  });

  it('validation error: password field is required', function() {
    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.com",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal('Password field is required');
      });
  });

  it('validation error: password must be at least 6 characters', function() {
    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.com",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "Dm",
        "password2": "DmNcMZKa488WiBy"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal('Password must be at least 6 characters');
      });
  });

  it('validation error: confirm password field is required', function() {
    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.com",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "DmNcMZKa488WiBy",
        "password2": ""
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password2).to.equal('Confirm password field is required');
      });
  });

  it('validation error: passwords must match', function() {
    return request(app)
      .post('/api/users/resetpassword')
      .send({
        "email": "amith.raravi@gmail.com",
        "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
        "password": "DmNcMZKa488WiBy",
        "password2": "DmN"
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password2).to.equal('Passwords must match');
      });
  });
});

describe('POST /logout', function() {
  it('success: logs off', function() {
    return request(app)
      .post('/api/users/logout')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVlNWVkY2E0M2FhOWRjNTg3NTAzZTFiNCIsIm5hbWUiOiJBbWl0aCBSYXJhdmkiLCJpYXQiOjE1ODUxOTcxNzEsImV4cCI6MTYxNjc1NDA5N30.4z8q_gKxZM8edbCeKLOYpBNEc-YB9cXvdM5TI0lDSCQ')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.logoff).to.equal('Logged off');
      });
  });

  it('error: session.destroy error', async function() {
    const mockResponse = () => {
      const res = {};
      // replace the following () => res
      // with your function stub/mock of choice
      // making sure they still return `res`
      // res.status = () => res;
      // res.json = () => res;
      res.status = sinon.stub().returns(res);
      res.json = sinon.stub().returns(res);
      return res;
    };

    const mockRequest = (sessionData) => {
      return {
        session: {
          data: sessionData,
          // destroy: (cb) => cb({error: "Error"}),
          destroy: sinon.stub().callsFake((cb) => cb({error: "Error"}))
        },
      };
    };

    const req = mockRequest();
    const res = mockResponse();
    await logout(req, res);
    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledWith(res.json, { logoff: "There was an error, please try again!" });
  });
});

describe('POST /sync', function() {
  let token;
  before(function(done) {
    request(app)
      .post(login.api)
      .send({"email": "amith.raravi@gmail.com", "password": "DmNcMZKa488WiBy"})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        token = response.body.token.slice(7);
        let tokenDecoded = jwtDecode(response.body.token);
        expect(response.body.success).to.equal(true);
        expect(tokenDecoded.name).to.equal('Amith Raravi');
        done();
      });
  });

  after(function(done) {
    // Delete session
    deleteSession(token);
    done();
  });

  it('success: note modified by another session (synceddate)', async function() {
    const note = {
      id: "dummyid1",
      userid: "dummyuser1",
      note: "dummynote1",
      modifieddate: new Date("2020-03-03T22:39:32.371Z"),
      createddate: new Date("2020-03-03T22:39:32.371Z"),
      modifiedsession: "dummysession1"
    };

    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(note);

    const mockResponse = () => {
      const res = {};
      // res.status = () => res;
      // res.json = () => res;
      res.status = sinon.stub().returns(res);
      res.json = sinon.stub().returns(res);
      return res;
    };

    const mockRequest = (sessionData) => {
      return {
        body: {
          "userid": "dummyuser1",
          "noteid": "dummynote1"
        },
        session: {
          data: sessionData,
          id: "dummysession2",
          synceddate: new Date("2020-03-02T22:39:32.371Z"),
        },
      };
    };

    const req = mockRequest();
    const res = mockResponse();
    await syncNote(req, res);
    sinon.assert.calledWith(res.json, {
      notemodified: "Note modified by another session",
      note: note.note,
      modifieddate: note.modifieddate
    });
    Note.findById.restore();
  });

  it('success: note modified by another session (req.session[noteid])', async function() {
    const note = {
      id: "dummyid1",
      userid: "dummyuser1",
      note: "dummynote1",
      modifieddate: new Date("2020-03-03T22:39:32.371Z"),
      createddate: new Date("2020-03-03T22:39:32.371Z"),
      modifiedsession: "dummysession1"
    };

    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(note);

    const mockResponse = () => {
      const res = {};
      // res.status = () => res;
      // res.json = () => res;
      res.status = sinon.stub().returns(res);
      res.json = sinon.stub().returns(res);
      return res;
    };

    const mockRequest = (sessionData) => {
      return {
        body: {
          "userid": "dummyuser1",
          "noteid": "dummynote1"
        },
        session: {
          data: sessionData,
          id: "dummysession2",
          "dummynote1": new Date("2020-03-02T22:39:32.371Z"),
          // synceddate: new Date("2020-03-02T22:39:32.371Z")
        },
      };
    };

    const req = mockRequest();
    const res = mockResponse();
    await syncNote(req, res);
    sinon.assert.calledWith(res.json, {
      notemodified: "Note modified by another session",
      note: note.note,
      modifieddate: note.modifieddate
    });
    Note.findById.restore();
  });

  it('success: no changes', async function() {
    const note = {
      id: "dummyid1",
      userid: "dummyuser1",
      note: "dummynote1",
      modifieddate: new Date("2020-03-03T22:39:32.371Z"),
      createddate: new Date("2020-03-03T22:39:32.371Z"),
      modifiedsession: "dummysession1"
    };

    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(note);

    const mockResponse = () => {
      const res = {};
      // res.status = () => res;
      // res.json = () => res;
      res.status = sinon.stub().returns(res);
      res.json = sinon.stub().returns(res);
      return res;
    };

    const mockRequest = (sessionData) => {
      return {
        body: {
          "userid": "dummyuser1",
          "noteid": "dummynote1"
        },
        session: {
          data: sessionData,
          id: "dummysession1",
          synceddate: new Date("2020-03-02T22:39:32.371Z")
        },
      };
    };

    const req = mockRequest();
    const res = mockResponse();
    await syncNote(req, res);
    sinon.assert.calledWith(res.json, {nochanges: "No changes"});
    Note.findById.restore();
  });

  it('success: note updated', function(done) {
    const note = {
      id: "dummyid1",
      userid: "dummyuser1",
      note: "dummynote1",
      modifieddate: new Date("2020-03-03T22:39:32.371Z"),
      createddate: new Date("2020-03-03T22:39:32.371Z"),
      modifiedsession: "dummysession1",
      save: sinon.stub().resolves({
        modifieddate: new Date("2020-03-04T22:39:32.371Z")
      })
    };

    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(note);

    const mockResponse = () => {
      const res = {};
      // res.status = () => res;
      // res.json = () => res;
      res.status = sinon.stub().returns(res);
      // res.json = sinon.stub().returns(res);
      res.json = sinon.stub().callsFake((body) => {
        res.body = body;
        return res;
      });
      return res;
    };

    const mockRequest = (sessionData) => {
      return {
        body: {
          "userid": "dummyuser1",
          "noteid": "dummynote1",
          "notetext": "dummytext"
        },
        session: {
          data: sessionData,
          id: "dummysession1",
          synceddate: new Date("2020-03-02T22:39:32.371Z")
        },
      };
    };

    const req = mockRequest();
    const res = mockResponse();
    syncNote(req, res);
    done();
    Note.findById.restore();
    sinon.assert.calledWith(res.json, {
      success: "Note updated!",
      modifieddate: new Date("2020-03-04T22:39:32.371Z")
    });
  });

  it('error: MongoDB save note error', function(done) {
    const note = {
      id: "dummyid1",
      userid: "dummyuser1",
      note: "dummynote1",
      modifieddate: new Date("2020-03-03T22:39:32.371Z"),
      createddate: new Date("2020-03-03T22:39:32.371Z"),
      modifiedsession: "dummysession1",
      save: sinon.stub().rejects({ error: "Error" })
    };

    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(note);

    const mockResponse = () => {
      const res = {};
      // res.status = () => res;
      // res.json = () => res;
      res.status = sinon.stub().returns(res);
      // res.json = sinon.stub().returns(res);
      res.json = sinon.stub().callsFake((body) => {
        res.body = body;
        return res;
      });
      return res;
    };

    const mockRequest = (sessionData) => {
      return {
        body: {
          "userid": "dummyuser1",
          "noteid": "dummynote1",
          "notetext": "dummytext"
        },
        session: {
          data: sessionData,
          id: "dummysession1",
          synceddate: new Date("2020-03-02T22:39:32.371Z")
        },
      };
    };

    const req = mockRequest();
    const res = mockResponse();
    syncNote(req, res);
    done();
    Note.findById.restore();
    sinon.assert.calledWith(res.json, { error: "There was an error, note couldn't be updated!" });
  });

  it('error: note not found', function() {
    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(null);

    return request(app)
      .post('/api/users/sync')
      .send({
        "userid": "dummyuser",
        "noteid": "dummynote"
      })
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token)
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.error).to.equal("Note not found");
        Note.findById.restore();
      });
  });

  it('error: userid mismatch', function() {
    const note = {
      id: "dummyid1",
      userid: "dummyuser1",
      note: "dummynote1",
      modifieddate: "2020-03-03T22:39:32.371Z",
      createddate: "2020-03-03T22:39:32.371Z"
    };

    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(note);

    return request(app)
      .post('/api/users/sync')
      .send({
        "userid": "dummyuser",
        "noteid": "dummynote"
      })
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token)
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.error).to.equal("Sync error");
        Note.findById.restore();
      });
  });
});

describe('POST /sendall', function() {
  let token;
  before(function(done) {
    request(app)
      .post(login.api)
      .send({"email": "amith.raravi@gmail.com", "password": "DmNcMZKa488WiBy"})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        token = response.body.token.slice(7);
        let tokenDecoded = jwtDecode(response.body.token);
        expect(response.body.success).to.equal(true);
        expect(tokenDecoded.name).to.equal('Amith Raravi');
        done();
      });
  });

  after(function(done) {
    // Delete session
    deleteSession(token);
    done();
  });

  it('success: notes sent', function() {
    const notes = [{
      id: "dummyid1",
      note: "dummynote1",
      modifieddate: "2020-03-03T22:39:32.371Z"
    },{
      id: "dummyid2",
      note: "dummynote2",
      modifieddate: "2020-03-03T22:39:32.371Z"
    }];
    const noteFind = sinon.stub(Note, 'find');
    noteFind.resolves(notes);

    return request(app)
      .post('/api/users/sendall')
      .send({
        "userid": "dummyuser"
      })
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token)
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.success).to.equal(true);
        expect(response.body.notes).to.deep.equal(notes);
        Note.find.restore();
      });
  });
});

describe('POST /new', function() {
  let token;
  before(function(done) {
    request(app)
      .post(login.api)
      .send({"email": "amith.raravi@gmail.com", "password": "DmNcMZKa488WiBy"})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        token = response.body.token.slice(7);
        let tokenDecoded = jwtDecode(response.body.token);
        expect(response.body.success).to.equal(true);
        expect(tokenDecoded.name).to.equal('Amith Raravi');
        done();
      });
  });

  after(function(done) {
    // Delete session
    deleteSession(token);
    done();
  });

  it('success: new note sent', function() {
    const note = {
      id: "dummyid1",
      note: "dummynote1",
      modifieddate: "2020-03-03T22:39:32.371Z",
      createddate: "2020-03-03T22:39:32.371Z"
    };
    const noteSave = sinon.stub(Note.prototype, 'save');
    noteSave.resolves(note);

    return request(app)
      .post('/api/users/new')
      .send({
        "userid": "dummyuser"
      })
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token)
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.note).to.deep.equal(note);
        Note.prototype.save.restore();
      });
  });

  it('error: adding to DB failed!', function() {
    const note = {
      id: "dummyid1",
      note: "dummynote1",
      modifieddate: "2020-03-03T22:39:32.371Z",
      createddate: "2020-03-03T22:39:32.371Z"
    };
    const noteSave = sinon.stub(Note.prototype, 'save');
    noteSave.rejects({error: "Error"});

    return request(app)
      .post('/api/users/new')
      .send({
        "userid": "dummyuser"
      })
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token)
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.error).to.equal('Adding to DB failed!');
        Note.prototype.save.restore();
      });
  });
});

describe('POST /delete', function() {
  let token;
  before(function(done) {
    request(app)
      .post(login.api)
      .send({"email": "amith.raravi@gmail.com", "password": "DmNcMZKa488WiBy"})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        token = response.body.token.slice(7);
        let tokenDecoded = jwtDecode(response.body.token);
        expect(response.body.success).to.equal(true);
        expect(tokenDecoded.name).to.equal('Amith Raravi');
        done();
      });
  });

  after(function(done) {
    // Delete session
    deleteSession(token);
    done();
  });

  it('success: note deleted', function() {
    const noteFindByIdAndRemove = sinon.stub(Note, 'findByIdAndRemove');
    noteFindByIdAndRemove.resolves({});

    return request(app)
      .post('/api/users/delete')
      .send({
        "userid": "dummyuser",
        "noteid": "dummynote"
      })
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token)
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.success).to.equal('Note deleted!');
        Note.findByIdAndRemove.restore();
      });
  });

  it('error: delete failed', function() {
    const noteFindByIdAndRemove = sinon.stub(Note, 'findByIdAndRemove');
    noteFindByIdAndRemove.rejects({error: "Error"});

    return request(app)
      .post('/api/users/delete')
      .send({
        "userid": "dummyuser",
        "noteid": "dummynote"
      })
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token)
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.error).to.equal('Delete failed!');
        Note.findByIdAndRemove.restore();
      });
  });
});

describe('GET /resetpassword', function() {
  it('success: responds with HTML', function() {
    return request(app)
      .get('/resetpassword')
      .expect('Content-Type', /text\/html/)
      .expect(200)
      .then(response => {
        expect(response.headers['content-type']).to.equal('text/html; charset=UTF-8');
        expect(response.headers['content-length']).to.equal('11330');
      });
  });
});

describe('Passport.js', function() {
  let token;
  before(function(done) {
    request(app)
      .post(login.api)
      .send({"email": "amith.raravi@gmail.com", "password": "DmNcMZKa488WiBy"})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        token = response.body.token.slice(7);
        let tokenDecoded = jwtDecode(response.body.token);
        expect(response.body.success).to.equal(true);
        expect(tokenDecoded.name).to.equal('Amith Raravi');
        done();
      });
  });

  after(function(done) {
    // Delete session
    deleteSession(token);
    done();
  });

  it('User.findOne: error', function() {
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.callsFake((p1, cb) => cb({error: "Error"}));

    return request(app)
      .post('/api/users/delete')
      .send({
        "userid": "dummyuser",
        "noteid": "dummynote"
      })
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token)
      .expect(500)
      .then(response => {
        expect(response.res.statusMessage).to.equal("Internal Server Error");
        User.findOne.restore();
      });
  });

  it('User.findOne: No user found', function() {
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.callsFake((p1, cb) => cb(null, null));

    return request(app)
      .post('/api/users/delete')
      .send({
        "userid": "dummyuser",
        "noteid": "dummynote"
      })
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token)
      .expect(401)
      .then(response => {
        expect(response.text).to.equal("Unauthorized");
        User.findOne.restore();
      });
  });
});
