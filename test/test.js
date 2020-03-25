const request = require('supertest');
const app = require('../server');
const expect = require('chai').expect;
const mongoose = require("mongoose");
const jwtDecode = require('jwt-decode');

describe('POST /login', function() {
  before(function() {
    console.log("  before");
  });

  after(function() {
    mongoose.disconnect();
    console.log("  after: disconnected DB");
  });

  it('success: responds with json', function() {
    return request(app)
      .post('/api/users/login')
      .send({"email": "amith.raravi@gmail.com", "password": "DmNcMZKa488WiBy"})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(response => {
        let tokenDecoded = jwtDecode(response.body.token);
        expect(response.body.success).to.equal(true);
        expect(tokenDecoded.name).to.equal('Amith Raravi');
      });
  });

  it('error: email not found', function() {
    return request(app)
      .post('/api/users/login')
      .send({"email": "amith.raravi@gmail.co", "password": "DmNcMZKa488WiBy"})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404)
      .then(response => {
        expect(response.body.email).to.equal('Email not found');
      });
  });

  it('error: password incorrect', function() {
    return request(app)
      .post('/api/users/login')
      .send({"email": "amith.raravi@gmail.com", "password": "DmNcMZKa488WiB"})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal('Password incorrect');
      });
  });

  it('validation error: email is empty', function() {
    return request(app)
      .post('/api/users/login')
      .send({"email": "", "password": "DmNcMZKa488WiBy"})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email field is required');
      });
  });

  it('validation error: email is invalid', function() {
    return request(app)
      .post('/api/users/login')
      .send({"email": "amith.raravigmail.com", "password": "DmNcMZKa488WiBy"})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.email).to.equal('Email is invalid');
      });
  });

  it('validation error: password is empty', function() {
    return request(app)
      .post('/api/users/login')
      .send({"email": "amith.raravi@gmail.com", "password": ""})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then(response => {
        expect(response.body.password).to.equal('Password field is required');
      });
  });
});
