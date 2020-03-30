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

let registerData = {
      api: '/api/users/register',
      json: null,
      success: 'New user registered successfully!',
      error: 'There was a problem, please try again!'
    },
    loginData = {
      api: '/api/users/login',
      json: null
    },
    forgotPasswordData = {
      api: '/api/users/forgotpassword',
      json: null,
      resolve: {email: "amith.raravi@gmail.com"},
      emailSuccess: 'The reset email has been sent, please check your inbox!',
      emailError: "The reset email couldn't be sent, please try again!"
    },
    resetPasswordData = {
      api: '/api/users/resetpassword',
      json: null,
      resolve: null,
      success: 'Password changed successfully!',
      error: "Password couldn't be changed, please try again!"
    },
    validationData = {
      emailExists: 'Email already exists',
      emailNotFound: 'Email not found',
      emailRequired: 'Email field is required',
      emailInvalid: 'Email is invalid',
      nameRequired: 'Name field is required',
      passwordIncorrect: 'Password incorrect',
      passwordRequired: 'Password field is required',
      passwordMinimumLength: 'Password must be at least 6 characters',
      password2Required: 'Confirm password field is required',
      password2Match: 'Passwords must match',
      resetCodeExpired: 'Reset code has expired',
      resetCodeInvalid: 'Reset code is invalid',
      resetCodeRequired: 'Reset code is required',
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
  setTimeout(() => {
    mongoose.disconnect();
    console.log("  after: disconnected DB");
  }, 500);
});

describe('POST /register', function() {
  beforeEach(function() {
    registerData.json = {
      "name": "Amith Raravi",
      "email": "amith.raravi1@gmail.com",
      "password": "DmNcMZKa488WiBy",
      "password2": "DmNcMZKa488WiBy"
    };
  });

  it('success: new user registered successfully', function() {
    return request(app)
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.createduser).to.equal(registerData.success);
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
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(registerData.error);
        bcrypt.hash.restore();
      });
  });

  it('error: User.save error', function() {
    const userSave = sinon.stub(User.prototype, 'save');
    userSave.rejects({error: "Error"});

    return request(app)
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(registerData.error);
        User.prototype.save.restore();
      });
  });

  it('error: email already exists', function() {
    registerData.json["email"] = "amith.raravi@gmail.com";
    return request(app)
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailExists);
      });
  });

  it('validation error: name field is required', function() {
    registerData.json["name"] = "";
    return request(app)
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.name).to.equal(validationData.nameRequired);
      });
  });

  it('validation error: email field is required', function() {
    registerData.json["email"] = "";
    return request(app)
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailRequired);
      });
  });

  it('validation error: email is invalid', function() {
    registerData.json["email"] = "amith.raravi1gmail.com";
    return request(app)
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailInvalid);
      });
  });

  it('validation error: password field is required', function() {
    registerData.json["password"] = "";
    return request(app)
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal(validationData.passwordRequired);
      });
  });

  it('validation error: password must be at least 6 characters', function() {
    registerData.json["password"] = "DmN";
    registerData.json["password2"] = "DmN";
    return request(app)
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal(validationData.passwordMinimumLength);
      });
  });

  it('validation error: password2 field is required', function() {
    registerData.json["password2"] = "";
    return request(app)
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password2).to.equal(validationData.password2Required);
      });
  });

  it('validation error: passwords must match', function() {
    registerData.json["password2"] = "DmNcMZ";
    return request(app)
      .post(registerData.api)
      .send(registerData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password2).to.equal(validationData.password2Match);
      });
  });
});

describe('POST /login', function() {
  beforeEach(function() {
    loginData.json = {
      "email": "amith.raravi@gmail.com",
      "password": "DmNcMZKa488WiBy",
    };
  });

  it('success: responds with json', function() {
    return request(app)
      .post(loginData.api)
      .send(loginData.json)
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
    loginData.json["email"] = "amith.raravi@gmail.co";
    return request(app)
      .post(loginData.api)
      .send(loginData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailNotFound);
      });
  });

  it('error: password incorrect', function() {
    loginData.json["password"] = "DmNcMZKa488WiB";
    return request(app)
      .post(loginData.api)
      .send(loginData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal(validationData.passwordIncorrect);
      });
  });

  it('validation error: email is empty', function() {
    loginData.json["email"] = "";
    return request(app)
      .post(loginData.api)
      .send(loginData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailRequired);
      });
  });

  it('validation error: email is invalid', function() {
    loginData.json["email"] = "amith.raravigmail.com";
    return request(app)
      .post(loginData.api)
      .send(loginData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailInvalid);
      });
  });

  it('validation error: password is empty', function() {
    loginData.json["password"] = "";
    return request(app)
      .post(loginData.api)
      .send(loginData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal(validationData.passwordRequired);
      });
  });
});

describe('POST /forgotpassword', function() {
  beforeEach(function() {
    forgotPasswordData.json = {
      "email": "amith.raravi@gmail.com"
    };
  });

  it('success: responds with email', function() {
    this.timeout(5000);
    const userSave = sinon.stub(User.prototype, 'save');
    userSave.resolves(forgotPasswordData.resolve);
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
      .post(forgotPasswordData.api)
      .send(forgotPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.emailsent).to.equal(forgotPasswordData.emailSuccess);
        nodemailer.createTransport.restore();
        User.prototype.save.restore();
      });
  });

  it('error: email sending failed', function() {
    this.timeout(5000);
    const userSave = sinon.stub(User.prototype, 'save');
    userSave.resolves(forgotPasswordData.resolve);
    // Without this stub, mail is sent every time!
    const transporter = sinon.stub(nodemailer, 'createTransport');
    transporter.returns({
      sendMail: (mailOptions) => Promise.reject({
        error: "Email couldn't be sent"
      })
    });

    return request(app)
      .post(forgotPasswordData.api)
      .send(forgotPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(forgotPasswordData.emailError);
        nodemailer.createTransport.restore();
        User.prototype.save.restore();
      });
  });

  it('error: bcrypt hashing failed', function() {
    this.timeout(5000);
    const bcryptHash = sinon.stub(bcrypt, 'hash');
    bcryptHash.callsFake((p1, p2, cb) => cb("Error"));

    return request(app)
      .post(forgotPasswordData.api)
      .send(forgotPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(forgotPasswordData.emailError);
        bcrypt.hash.restore();
      });
  });

  it('error: email not found', function() {
    forgotPasswordData.json["email"] = "amith.raravi1@gmail.com";
    return request(app)
      .post(forgotPasswordData.api)
      .send(forgotPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailNotFound);
      });
  });

  it('validation error: email field is required', function() {
    forgotPasswordData.json["email"] = "";
    return request(app)
      .post(forgotPasswordData.api)
      .send(forgotPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailRequired);
      });
  });

  it('validation error: email is invalid', function() {
    forgotPasswordData.json["email"] = "amith.raravigmail.com";
    return request(app)
      .post(forgotPasswordData.api)
      .send(forgotPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailInvalid);
      });
  });
});

describe('POST /resetpassword', function() {
  beforeEach(function() {
    resetPasswordData.json = {
      "email": "amith.raravi@gmail.com",
      "resetcode": "e1ca0470bd9c356a7c5ec0e89c246f9b",
      "password": "DmNcMZKa488WiBy",
      "password2": "DmNcMZKa488WiBy"
    };
    resetPasswordData.resolve = {
      _id: '5e5edca43aa9dc587503e1b4',
      name: 'Amith Raravi',
      email: 'amith.raravi@gmail.com',
      password: '$2a$12$.TdDUPO04ICoSdHmVy90x.rBptpYykbAFd4bTqxrEuutJQR2zjV5K',
      date: new Date('2020-03-03T22:39:32.371Z'),
      __v: 0,
      resetPasswordExpires: new Date('2220-03-26T03:26:04.136Z'),
      resetPasswordToken: '$2a$12$5z5/4rfoZHi7y4nrtvtHzuWgA8d9UnCLQpydhHLvm3hS.gpo9akkW'
    };
  });

  it('success: password changed successfully', function() {
    let userFindOneResolve = Object.assign({}, resetPasswordData.resolve);
    userFindOneResolve.save = () => Promise.resolve(resetPasswordData.resolve);
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(userFindOneResolve);

    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.success).to.equal(resetPasswordData.success);
        User.findOne.restore();
      });
  });

  it('error: bcrypt hashing error', function() {
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(resetPasswordData.resolve);

    const bcryptCompare = sinon.stub(bcrypt, 'compare');
    bcryptCompare.resolves(true);

    const bcryptHash = sinon.stub(bcrypt, 'hash');
    bcryptHash.callsFake((p1, p2, cb) => cb("Error"));

    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.resetcode).to.equal(resetPasswordData.error);
        bcrypt.hash.restore();
        bcrypt.compare.restore();
        User.findOne.restore();
      });
  });

  it('error: password saving to DB failed', function() {
    resetPasswordData.resolve.save = () => Promise.reject({error: "Error"});
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(resetPasswordData.resolve);

    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.resetcode).to.equal(resetPasswordData.error);
        User.findOne.restore();
      });
  });

  it('error: email not found', function() {
    resetPasswordData.json["email"] = "amith.raravi@gmail.co";
    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailNotFound);
      });
  });

  it('error: reset code has expired', function() {
    resetPasswordData.resolve.resetPasswordExpires = new Date('2020-03-26T03:26:04.136Z');
    resetPasswordData.resolve.save = () => {};
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.resolves(resetPasswordData.resolve);

    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {console.log(response.body);
        expect(response.body.resetcode).to.equal(validationData.resetCodeExpired);
        User.findOne.restore();
      });
  });

  it('error: reset code is invalid', function() {
    resetPasswordData.json["resetcode"] = "8c4e65";
    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.resetcode).to.equal(validationData.resetCodeInvalid);
      });
  });

  it('validation error: email field is required', function() {
    resetPasswordData.json["email"] = "";
    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailRequired);
      });
  });

  it('validation error: email is invalid', function() {
    resetPasswordData.json["email"] = "amith.raravigmail.com";
    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal(validationData.emailInvalid);
      });
  });

  it('validation error: reset code is required', function() {
    resetPasswordData.json["resetcode"] = "";
    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.resetcode).to.equal(validationData.resetCodeRequired);
      });
  });

  it('validation error: password field is required', function() {
    resetPasswordData.json["password"] = "";
    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal(validationData.passwordRequired);
      });
  });

  it('validation error: password must be at least 6 characters', function() {
    resetPasswordData.json["password"] = "Dm";
    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal(validationData.passwordMinimumLength);
      });
  });

  it('validation error: confirm password field is required', function() {
    resetPasswordData.json["password2"] = "";
    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password2).to.equal(validationData.password2Required);
      });
  });

  it('validation error: passwords must match', function() {
    resetPasswordData.json["password"] = "DmN";
    return request(app)
      .post(resetPasswordData.api)
      .send(resetPasswordData.json)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password2).to.equal(validationData.password2Match);
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
      .post(loginData.api)
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
      .post(loginData.api)
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
      .post(loginData.api)
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
      .post(loginData.api)
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
      .post(loginData.api)
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
