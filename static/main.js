// Global objects
let strava, map, dom;
// Elements to be fetched
const elementIds = ["container", "home", "loader", "connectWithStrava", "config", "backgroundColor", "lineColor", "activityTag", "generateButton", "outputContainer", "output", "configButton", "downloadButton", "activityTagError"];
// Global variables
let loading = false;
let stravaReady = false;
// Store the Pickr objects for background and line colors
let pBackgroundColor, pLineColor;

// Sets the event listeners up
function initEventListeners() {
    dom.connectWithStrava.addEventListener("click", () => {
        if (dom.connectWithStrava.getAttribute("disabled") == null) {
            initStrava();
        }
    });
    dom.generateButton.addEventListener("click", () => {
        testInputs();
    });
    dom.configButton.addEventListener("click", () => {
        hide(dom.outputContainer);
        show(dom.container);
    });
    dom.downloadButton.addEventListener("click", () => {
        map.download();
    });
}

// Checks the hash in the URL to see if a certain action needs to be completed
function checkHash() {
    if (location.hash != "") {
        let hash = location.hash.match(/^#(.*)$/)[1];
        switch (hash) {
            case "refreshed":
                dom.connectWithStrava.click();
                break;
        }
        location.hash = "";
    }
}

// Gets needed variables from server
function getVars() {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", "/vars");
        xhr.addEventListener("load", () => {
            resolve(JSON.parse(xhr.responseText));
        });
        xhr.addEventListener("error", () => {
            reject("Error retrieving variables from server");
        });
        xhr.send();
    });
}

function initStrava() {
    if (!stravaReady) {
        disable(dom.connectWithStrava);
        loading = true;
        getVars().then((vars) => {
            strava = new Strava(vars.clientId);

            strava.init().then(() => {
                postStrava();
            }).catch((e) => {
                console.error(e);
            });
        }).catch((e) => {
            console.error(e);
        });
    } else {
        postStrava();
    }
}

function postStrava() {
    stravaReady = true;
    enable(dom.connectWithStrava);
    loading = false;

    hide(dom.home);
    show(dom.config);
}

// Goes through all the config inputs and checks that they've been entered
function testInputs() {
    let backgroundColor = pBackgroundColor.getColor().toHEX().toString();
    let lineColor = pLineColor.getColor().toHEX().toString();
    let activityTag = dom.activityTag.value;
    if (activityTag == "") {
        addActivityError("This can't be empty");
    } else {
        // Search the activities
        let activities = strava.search(activityTag);

        // Everything's fine
        if (activities.length > 0) {
            removeActivityError();
            disable(dom.generateButton);
            
            // Puts it in the document so offsetHeight can be used, but the user can't see it
            show(dom.outputContainer);
            dom.outputContainer.style.opacity = 0;
            map = new Map(dom.output, backgroundColor, lineColor);
            
            loading = true;
            strava.getActivities(activities).then((activities) => {
                // Add all of the activities
                activities.map((activity) => {
                    let line = activity.map.polyline;
                    if (line != null) map.add(line);
                });

                // Show the output
                hide(dom.container);
                dom.outputContainer.style.opacity = 1;

                loading = false;
                enable(dom.generateButton);
            });
        } else {
            addActivityError("There are no activities for this tag");
        }
    }
}

// Init function
function init() {
    // Fetch all the elements
    dom = {};
    elementIds.map((el) => {
        dom[el] = document.getElementById(el);
    });

    initEventListeners();
    checkLoading();
    checkHash();
    
    pickrInit();
}

init();
