class Strava {
    constructor(clientId, infoFunction) {
        this.infoFunction = infoFunction;

        // Test to see if authentication tokens are present
        let rawCookies = document.cookie.split(";");
        let cookies = {};
        for (let cookie of rawCookies) {
            cookie = cookie.split("=");
            cookie[0] = cookie[0].trim();
            cookies[cookie[0]] = cookie[1];
        }

        // Constants
        this.clientId = clientId;
        this.redirectUri = `${window.location.protocol}//${window.location.host}/auth`;
        this.scope = "activity:read_all";
        this.authorizeEndpoint = "https://www.strava.com/oauth/authorize";
        this.apiEndpoint = "https://www.strava.com/api/v3"

        this.authenticated = false;

        this.activities = {};
        // Keeps track of the activities
        this.activityIds = [];

        if (Object.keys(cookies).indexOf("accessToken") > -1) {
            // Authenticated!
            this.authenticated = true
            this.accessToken = cookies.accessToken;
        }
        if (Object.keys(cookies).indexOf("refreshToken") > -1) {
            this.refreshToken = cookies.refreshToken;
        }

        // Load the cache
        this.cache = localStorage.getItem("strava");
        if (this.cache == null) this.cache = {};
        else this.cache = JSON.parse(this.cache);
    }

    // Doubles as console.log and infoFunction caller
    notify(message) {
        console.log(message);
        if (this.infoFunction != undefined) this.infoFunction(message);
    }

    init() {
        return new Promise((resolve, reject) => {
            this.notify("Authenticating with Strava");
            this.authenticate().then(() => {
                this.notify("Already authenticated. Retrieving athlete id");
                this.getAthleteId().then(() => {
                    this.notify("Retrieving activity list");
                    this.getActivityList().then(() => {
                        resolve();
                    });
                }).catch(reject);
            }).catch((err) =>{
                this.notify(err);
            });
        });
    }

    authenticate() {
        return new Promise((resolve, reject) => {
            if (this.authenticated) {
                // Already authenticated
                resolve();
            } else if (this.refreshToken != undefined) {
                // Refresh token present, just need to gain access token
                location = `/refresh?refreshToken=${this.refreshToken}`;
                reject("Retrieving refresh token");
            } else {
                // Authenticate with Strava
                let url = `${this.authorizeEndpoint}?client_id=${this.clientId}&redirect_uri=${this.redirectUri}&response_type=code&scope=${this.scope}`;
                // Redirect to Strava OAuth page
                location = url;
                reject("Redirecting to Strava for authentication");
            }
        });
    }

    request(path, params) {
        return new Promise((resolve, reject) => {
            let querystring = "";
            if (params != undefined) {
                for (let param in params) {
                    if (querystring.length > 0) {
                        querystring += "&";
                    }
                    querystring += `${param}=${params[param]}`;
                }
            }
            
            let url = `${this.apiEndpoint}/${path}?${querystring}`;
            console.log(` -> Requesting ${url}`);

            let xhr = new XMLHttpRequest();
            xhr.open("GET", url);
            xhr.setRequestHeader("Authorization", `Bearer ${this.accessToken}`);
            xhr.addEventListener("load", () => {
                if (xhr.status == 200) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(xhr.responseText);
                }
            });
            xhr.send();
        });
    }

    // Gets id of athlete
    getAthleteId() {
        return new Promise((resolve, reject) => {
            if (this.inCache("athleteId")) {
                resolve(this.cache["athleteId"]);
            } else {
                this.request("athlete").then((athleteData) => {
                    this.setCache("athleteId", athleteData.id);
                    resolve(athleteData.id);
                }).catch(reject);
            }
        }).then((athleteId) => {
            this.athleteId = athleteId;
        });
    }

    // Get the data for an activity
    getActivity(id) {
        return new Promise((resolve, reject) => {
            if (this.activities[id].full == false) {
                this.request(`activities/${id}`).then((activity) => {
                    activity.full = true;
                    this.activities[id] = activity;
                    this.setCache("activities", this.activities);
                    
                    resolve();
                }).catch(reject);
            } else resolve();
        }).then(() => {
            return this.activities[id];
        });
    }

    getActivities(ids) {
        let promises = [];
        ids.forEach((id) => {
            promises.push(this.getActivity(id));
        });

        return Promise.all(promises);
    }

    // Recursively gets activities
    getActivityPages(page) {
        return new Promise((resolve, reject) => {
            this.request("athlete/activities", {page: page, per_page: 30}).then((activities) => {
                // Add new activities to current activities if it hasn't already been saved
                activities.map((activity) => {
                    if (!this.activityIds.includes(activity.id)) {
                        this.activityIds.push(activity.id);
                        // Used to keep track of whether it's the summary or the full activity
                        activity.full = false;
                        this.activities[activity.id] = activity;
                    }
                });

                // If less than 30 activities are in a page then that's the end
                if (activities.length == 30) {
                    // Still another page to go
                    this.getActivityPages(page + 1).then(() => {
                        // All the pages have been saved
                        resolve();
                    }).catch(reject);
                } else resolve();
            }).catch(reject);
        });
    }


    getActivityList() {
        let page = 1;
        // If stuff is already saved in the cache load it
        if (this.inCache("activityIds")) {
            this.activityIds = this.cache["activityIds"];
            this.activities = this.cache["activities"];
            
            // 30 activities per page. Only the last page needs to be re-requested, and if more follow they will be requested
            page = Math.floor(this.activityIds.length / 30) + 1;
        }

        // Start downloading the pages
        return this.getActivityPages(page).then(() => {
            this.setCache("activityIds", this.activityIds);
            this.setCache("activities", this.activities);
        });
    }

    search(regex) {
        return this.activityIds.reduce((matches, activityId) => {
            let activity = this.activities[activityId];
            if (activity.name.match(regex)) {
                matches.push(activityId);
            }
            return matches;
        }, []);
    }

    inCache(name) {
        return this.cache[name] != undefined;
    }
    setCache(name, value) {
        this.cache[name] = value;
        localStorage.setItem("strava", JSON.stringify(this.cache));
    }
}