/*
* Functions to show and hide elements
*/
function show(element) {
    element.classList.remove("hidden");
}
function hide(element) {
    element.classList.add("hidden");
}
function toggle(element) {
    element.classList.toggle("hidden");
}

/*
* Functions control pickr
*/
function pickrInit() {
    let options = {
        comparison: false,
        components: {
            preview: false,
            opacity: false,
            hue: true,
            interaction: {
                hex: true,
                rgba: true,
                hsla: false,
                hsva: false,
                cmyk: false,
                input: true,
                clear: false,
                save: false
            }
        }
    }
    pBackgroundColor = Pickr.create({el: dom.backgroundColor, default: "#000000", ...options});
    pLineColor = Pickr.create({el: dom.lineColor, default: "#ffffff", ...options});
}

function addActivityError(message) {
    dom.activityTag.classList.add("error");
    dom.activityTagError.innerText = message;
    show(dom.activityTagError);
}
function removeActivityError() {
    dom.activityTag.classList.remove("error");
    hide(dom.activityTagError);
    dom.activityTagError.innerText = "";
}

/*
*   Functions to start and stop loading animation
*/
function checkLoading() {
    if (loading) dom.loader.classList.add("loading");
    else dom.loader.classList.remove("loading");
    requestAnimationFrame(checkLoading);
}

// Disables an element
function disable(element) {
    element.setAttribute("disabled", true);
}
// Enables an element
function enable(element) {
    element.removeAttribute("disabled");
}