if (process.env.ENVIRONMENT != 'PROD') {
  require('dotenv').config();
}
const request = require('supertest');
const { app, mongoStore } = require('../server');
const expect = require('chai').expect;
const sinon = require('sinon');
const mongoose = require("mongoose");
const { logout,
        syncNote,
        initialSync } = require("../routes/api/functions");

/**
 * Load User / Note / Session models
 */
const User = require("../models/User");
const Note = require("../models/Note");

/**
 * Stubs / Mocks
 */
const mockDateOther = new Date("2020-03-02T22:39:32.371Z"),
      mockDateCreated = new Date("2020-03-03T22:39:32.371Z"),
      mockDateExpired = new Date("2020-03-04T22:39:32.371Z"),
      mockDateFuture = new Date("2220-03-26T22:39:32.371Z");

const mockRequest = (sessionData) => {
  return {
    body: {
      "userid": "dummyuser1",
      "noteid": "dummynote1"
    },
    session: {
      data: sessionData,
    },
  };
};

const mockResponse = () => {
  const res = {};
  // res.status = () => res;
  // res.json = () => res;
  res.status = sinon.stub().returns(res);
  res.json = sinon.stub().returns(res);
  return res;
};

let token1000Years =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVlNWVkY2E0M2FhOWRjNTg3NTAzZTFiNCIsIm5hbWUiOiJBbWl0aCBSYXJhdmkiLCJpYXQiOjE1ODc1MTA5MTUsImV4cCI6MzMxNDQ0MzY5MTV9.O1SHJWvo4s7fYjU-6LsbDhaaZ72LhFe5ILijOe2y3NM",
    logoutData = {
      api: '/api/users/logout',
      token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVlNWVkY2E0M2FhOWRjNTg3NTAzZTFiNCIsIm5hbWUiOiJBbWl0aCBSYXJhdmkiLCJpYXQiOjE1ODc1MTA5MTUsImV4cCI6MzMxNDQ0MzY5MTV9.O1SHJWvo4s7fYjU-6LsbDhaaZ72LhFe5ILijOe2y3NM',
      loggedOff: 'Logged off',
      error: { logoff: "There was an error, please try again!" },
    },
    syncData = {
      api: '/api/users/sync',
      json: {
        "userid": "dummyuser",
        "noteid": "dummynote"
      },
      note: null,
      errorNotUpdated: { error: "There was an error, note couldn't be updated!" },
      errorNotFound: "Note not found",
      errorNotSynced: "Sync error"
    },
    sendAllData = {
      api: '/api/users/sendall',
      json: {
        "userid": "dummyuser"
      },
      notes: [{
        id: "dummyid1",
        note: "dummynote1",
        modifieddate: "2020-03-03T22:39:32.371Z"
      },{
        id: "dummyid2",
        note: "dummynote2",
        modifieddate: "2020-03-03T22:39:32.371Z"
      }]
    },
    newNoteData = {
      api: '/api/users/new',
      json: {
        "userid": "dummyuser"
      },
      note: {
        id: "dummyid1",
        note: "dummynote1",
        modifieddate: "2020-03-03T22:39:32.371Z",
        createddate: "2020-03-03T22:39:32.371Z"
      },
      error: 'Adding to DB failed!'
    },
    deleteNoteData = {
      api: '/api/users/delete',
      json: {
        "userid": "dummyuser",
        "noteid": "dummynote"
      },
      success: 'Note deleted!',
      error: 'Delete failed!'
    }
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
    },
    errorData = {
      simpleError: { error: "Error" }
    };

before(function() {
  console.log("  before");
});

after(function() {
  setTimeout(() => {
    mongoose.disconnect();
    mongoStore.close();
    console.log("  after: disconnected DB");
  }, 500);
});

/**
 * Tests for the LOGOUT endpoint.
 */
describe('POST /logout', function() {
  it('success: logs off', function() {
    return request(app)
      .post(logoutData.api)
      .set('Authorization', logoutData.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.logoff).to.equal(logoutData.loggedOff);
      });
  });

  it('error: session.destroy error', async function() {
    const req = mockRequest();
    const res = mockResponse();
    req.session.destroy = sinon.stub().callsFake((cb) => cb(errorData.simpleError));

    await logout(req, res);

    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledWith(res.json, logoutData.error);
  });
});

/**
 * Tests for the SYNC endpoint.
 */
describe('POST /sync', function() {
  beforeEach(function() {
    syncData.note = {
      id: "dummyid1",
      userid: "dummyuser1",
      note: "dummynote1",
      modifieddate: mockDateCreated,
      createddate: mockDateCreated,
      modifiedsession: "dummysession1"
    };
  });

  it('success: note modified by another session (synceddate)', async function() {
    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(syncData.note);
    const req = mockRequest();
    const res = mockResponse();
    req.session.id = "dummysession2";
    req.session.synceddate = mockDateOther;

    await syncNote(req, res);

    sinon.assert.calledWith(res.json, {
      notemodified: "Note modified by another session",
      note: syncData.note.note,
      modifieddate: syncData.note.modifieddate
    });
    Note.findById.restore();
  });

  it('success: note modified by another session (req.session[noteid])', async function() {
    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(syncData.note);

    const req = mockRequest();
    const res = mockResponse();
    req.session.id = "dummysession2";
    req.session["dummynote1"] = mockDateOther;

    await syncNote(req, res);

    sinon.assert.calledWith(res.json, {
      notemodified: "Note modified by another session",
      note: syncData.note.note,
      modifieddate: syncData.note.modifieddate
    });
    Note.findById.restore();
  });

  it('success: no changes', async function() {
    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(syncData.note);

    const req = mockRequest();
    const res = mockResponse();
    req.session.id = "dummysession1";
    req.session.synceddate = mockDateOther;

    await syncNote(req, res);

    sinon.assert.calledWith(res.json, {nochanges: "No changes"});
    Note.findById.restore();
  });

  it('success: note updated', function(done) {
    syncData.note.save = sinon.stub().resolves({
      modifieddate: mockDateExpired
    });
    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(syncData.note);

    const req = mockRequest();
    const res = mockResponse();
    req.body["notetext"] = "dummytext";
    req.session.id = "dummysession1";
    req.session.synceddate = mockDateOther;
    res.json = sinon.stub().callsFake((body) => {
      res.body = body;
      return res;
    });

    syncNote(req, res);
    done();

    Note.findById.restore();
    sinon.assert.calledWith(res.json, {
      success: "Note updated!",
      modifieddate: mockDateExpired
    });
  });

  it('error: MongoDB save note error', function(done) {
    syncData.note.save = sinon.stub().rejects(errorData.simpleError);
    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(syncData.note);

    const req = mockRequest();
    const res = mockResponse();
    req.body["notetext"] = "dummytext";
    req.session.id = "dummysession1";
    req.session.synceddate = mockDateOther;
    res.json = sinon.stub().callsFake((body) => {
      res.body = body;
      return res;
    });

    syncNote(req, res);
    done();

    Note.findById.restore();
    sinon.assert.calledWith(res.json, syncData.errorNotUpdated);
  });

  it('error: note not found', function() {
    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(null);

    return request(app)
      .post(syncData.api)
      .send(syncData.json)
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token1000Years)
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.error).to.equal(syncData.errorNotFound);
        Note.findById.restore();
      });
  });

  it('error: userid mismatch', function() {
    const noteFindById = sinon.stub(Note, 'findById');
    noteFindById.resolves(syncData.note);

    return request(app)
      .post(syncData.api)
      .send(syncData.json)
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token1000Years)
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.error).to.equal(syncData.errorNotSynced);
        Note.findById.restore();
      });
  });
});

/**
 * Tests for the INITIALSYNC endpoint.
 */
describe('POST /initialsync', function() {
  it('success: notes sent', async function() {
    const noteFind = sinon.stub(Note, 'find');
    noteFind.resolves(sendAllData.notes);

    const req = mockRequest();
    const res = mockResponse();

    await initialSync(req, res);

    sinon.assert.calledWith(res.json, {
      success: true,
      notes: sendAllData.notes
    });
    Note.find.restore();
  });
});

/**
 * Tests for the SENDALL endpoint.
 */
describe('POST /sendall', function() {
  it('success: notes sent', function() {
    const noteFind = sinon.stub(Note, 'find');
    noteFind.resolves(sendAllData.notes);

    return request(app)
      .post(sendAllData.api)
      .send(sendAllData.json)
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token1000Years)
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.success).to.equal(true);
        expect(response.body.notes).to.deep.equal(sendAllData.notes);
        Note.find.restore();
      });
  });
});

/**
 * Tests for the NEW endpoint.
 */
describe('POST /new', function() {
  it('success: new note sent', function() {
    const noteSave = sinon.stub(Note.prototype, 'save');
    noteSave.resolves(newNoteData.note);

    return request(app)
      .post(newNoteData.api)
      .send(newNoteData.json)
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token1000Years)
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.note).to.deep.equal(newNoteData.note);
        Note.prototype.save.restore();
      });
  });

  it('error: adding to DB failed!', function() {
    const noteSave = sinon.stub(Note.prototype, 'save');
    noteSave.rejects(errorData.simpleError);

    return request(app)
      .post(newNoteData.api)
      .send(newNoteData.json)
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token1000Years)
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.error).to.equal(newNoteData.error);
        Note.prototype.save.restore();
      });
  });
});

/**
 * Tests for the DELETE endpoint.
 */
describe('POST /delete', function() {
  it('success: note deleted', function() {
    const noteFindByIdAndRemove = sinon.stub(Note, 'findByIdAndRemove');
    noteFindByIdAndRemove.resolves({});

    return request(app)
      .post(deleteNoteData.api)
      .send(deleteNoteData.json)
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token1000Years)
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        expect(response.body.success).to.equal(deleteNoteData.success);
        Note.findByIdAndRemove.restore();
      });
  });

  it('error: delete failed', function() {
    const noteFindByIdAndRemove = sinon.stub(Note, 'findByIdAndRemove');
    noteFindByIdAndRemove.rejects(errorData.simpleError);

    return request(app)
      .post(deleteNoteData.api)
      .send(deleteNoteData.json)
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token1000Years)
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.error).to.equal(deleteNoteData.error);
        Note.findByIdAndRemove.restore();
      });
  });
});

/**
 * Tests for the Passport authentication.
 */
describe('Passport.js', function() {
  it('User.findOne: error', function() {
    const userFindOne = sinon.stub(User, 'findOne');
    userFindOne.callsFake((p1, cb) => cb(errorData.simpleError));

    return request(app)
      .post(deleteNoteData.api)
      .send(deleteNoteData.json)
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token1000Years)
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
      .post(deleteNoteData.api)
      .send(deleteNoteData.json)
      .set('Accept', 'application/json')
      .set('Authorization', "Bearer " + token1000Years)
      .expect(401)
      .then(response => {
        expect(response.text).to.equal("Unauthorized");
        User.findOne.restore();
      });
  });
});
