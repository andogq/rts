// Environment
require("dotenv").config();

// Imports
const Strava = require("./strava");
const Server = require("./server");

let strava = new Strava(process.env.STRAVA_CLIENT_ID, process.env.STRAVA_KEY);
let server = new Server();

function sendVars() {
    return new Promise((resolve) => {
        resolve({
            statusCode: 200,
            data: JSON.stringify({clientId: process.env.STRAVA_CLIENT_ID})
        });
    });
}

function init() {
    server.addFunction("auth", strava.auth.bind(strava));
    server.addFunction("refresh", strava.refresh.bind(strava));
    server.addFunction("vars", sendVars);
    server.start();
}

init();