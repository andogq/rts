// Imports
const querystring = require("querystring");
const url = require("url");
const https = require("https");

class Strava {
    constructor (clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    // Makes an oauth request to Strava. Used for authenticating and refreshing
    oauth(parameters) {
        return new Promise((resolve, reject) => {
            // Build URL
            parameters = {
                ...parameters,
                client_id: this.clientId,
                client_secret: this.clientSecret
            }
            let href = new url.URL(`https://www.strava.com/oauth/token?${querystring.stringify(parameters)}`);

            // Set up request
            let req = https.request({
                host: href.hostname,
                path: href.pathname + href.search,
                method: "POST"
            }, (res) => {
                res.setEncoding("utf8");

                // Catches response from Strava
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });
                res.on("end", () => {
                    console.log("Request response recieved");
                    data = JSON.parse(data);
                    // Expiry returned in seconds, convert to milliseconds
                    resolve({
                        statusCode: 200,
                        cookies: [
                            {name: "accessToken", value: data.access_token, expires: new Date(data.expires_at * 1000).toUTCString()},
                            {name: "refreshToken", value: data.refresh_token, expires: new Date(Date.now() + (1000 * 60 * 60 * 24 * 365))} // The refresh token will expire in about a year
                        ],
                        data: `<html><meta http-equiv="refresh" content="0; /#refreshed"/></html>` // Redirect client to main page
                    });
                });
                res.on("error", () => {
                    reject();
                });
            });
            req.end();
        });
    }

    // Uses an authorization code from the client to get an access token from Strava
    auth(request) {
        console.log("Sending authorization request to Strava");
        return this.oauth({
            code: querystring.parse(request.url.query).code,
            grant_type: "authorization_code"
        });
    }

    // Refreshes an access token
    refresh(request) {
        return this.oauth({
            grant_type: "refresh_token",
            refresh_token: querystring.parse(request.url.query).refreshToken
        });
    }
}

module.exports = Strava;