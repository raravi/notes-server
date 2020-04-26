# notes-server

A node.js server for notes app.

![license](https://img.shields.io/github/license/raravi/notes-server)&nbsp;&nbsp;![version](https://img.shields.io/github/package-json/v/raravi/notes-server)&nbsp;&nbsp;![coverage](https://img.shields.io/codecov/c/gh/raravi/notes-server)&nbsp;&nbsp;![dependencies](https://img.shields.io/depfu/raravi/notes-server)&nbsp;&nbsp;![last-commit](https://img.shields.io/github/last-commit/raravi/notes-server)

The server runs in **node.js** using [Express](https://expressjs.com/) to setup a server to listen to requests to API endpoints and `/resetpassword` route.

## Server features

1. Sets up middleware for Rate Limiting, [Passport](http://www.passportjs.org/) (used for authentication), Body Parser (used for JSON).
2. Connects to the MongoDB using [Mongoose](https://mongoosejs.com/docs/guide.html) for CRUD operations.
3. **Express** server to serve API endpoints & `/resetpassword` webpage

## API endpoints

This repo contains the following:
1. `/sync`: Realtime synching of notes to the Database, called every 5 seconds from [notes-clent](https://github.com/raravi/notes-client) app.
2. `/sendall`: Send All notes to the client, called every 5 seconds from the **notes-client** app.
3. `/new`: Create a new note in the DB.
4. `/delete`: Delete the selected note from the DB.
5. `/logout`: Log out the current authenticated user.

The below endpoints are moved to the repo [notes-server-lambda](https://github.com/raravi/notes-server-lambda) as I've split it into AWS Lambda function!
1. `/login`: For login of users.
2. `/register`: To register new users.
3. `/forgotpassword`: To send a reset mail to the registered email address of the user.
4. `/resetpassword`: To handle reset password functionality.

**Note**: API endpoints '/sync', `/sendall`, `/new`, `/delete` and `/logout` need to be authenticated by **Passport.js** to work. The client needs to send the JSON webtoken through the **Authorization** header. Please see the **notes-client** for how the API calls are made.

## RESET POST Request

The `/resetpassword` POST Request is handled by sending the `/resetpassword/index.html` webpage back to the user, where they can enter relevant details to reset the password.

## Mailing feature

A mail is triggered to the user with the [nodemailer](https://nodemailer.com/usage/) package, you will need to setup your existing email Id for this. Or you can create a new one. You have to create a 'app password' (Gmail/Yahoo/etc.. each have their own way of generating app passwords, please consult the relevant documentation as per your requirements) and use it to send mails!

## Testing (Mocha, Chai, Sinon & Supertest)

This project has a code coverage of 100% with functional as well as unit tests written with care.

Have fun with the code!
