class Map {
    constructor(canvas, background, lineColor, lineWidth) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");

        // Add function to ctx which automatically adjusts for the inversion of the y axis
        this.ctx.addPoint = function(x, y) {
            this.lineTo(x, this.canvas.height - y);
        }
        
        this.padding = 0.1;
        this.resolutionFactor = 3;

        this.background = background == undefined ? "black" : background;
        this.lineColor = lineColor == undefined ? "white" : lineColor;
        this.lineWidth = (lineWidth == undefined ? 1 : lineWidth) * this.resolutionFactor;
        
        // Initialise canvas
        this.canvas.style.height = "100%";
        this.canvas.style.width = "100%";

        // Event listener to redraw when resized
        window.addEventListener("resize", this.refresh.bind(this));

        this.activities = [];
        this.refresh();
    }

    clearMap() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.background == undefined ? "black" : this.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Calculates the bounds of all the activities
    calculateBounds() {
        if (this.activities.length > 0) {
            if (this.bounds == undefined) this.bounds = {};
            for (let activity of this.activities) {
                for (let point of activity) {
                    if (this.bounds.lat == undefined) this.bounds.lat = {max: point.lat, min: point.lat};
                    if (this.bounds.lon == undefined) this.bounds.lon = {max: point.lon, min: point.lon};
                    
                    // Work out if the point is inside the current this.bounds
                    if (point.lat > this.bounds.lat.max) this.bounds.lat.max = point.lat;
                    else if (point.lat < this.bounds.lat.min) this.bounds.lat.min = point.lat;
                    if (point.lon > this.bounds.lon.max) this.bounds.lon.max = point.lon;
                    else if (point.lon < this.bounds.lon.min) this.bounds.lon.min = point.lon;
                }
            }

            // Work out the range
            this.bounds.lat.range = this.bounds.lat.max - this.bounds.lat.min;
            this.bounds.lon.range = this.bounds.lon.max - this.bounds.lon.min;

            // Must be defined first otherwise an error will be thrown
            this.bounds.largest = "";
            this.bounds.shortest = "";
            // The data with the largest and shortest range
            [this.bounds.largest, this.bounds.shortest] = this.bounds.lat.range > this.bounds.lon.range ? ["lat", "lon"] : ["lon", "lat"];
        }
    }

    add(activity) {
        // Convert to gpx if it's a polyline
        if (typeof(activity) == "string") activity = Map.polylineToGpx(activity);

        for (let point of activity) {
            // Make all the points between 0 and 180 for lat and 0 and 360 for lon
            point.lat += 90;
            point.lon += 180;
        }

        this.activities.push(activity);
        this.refresh();
    }

    // Turns a gpx coordinate into a canvas coordinate
    project(point) {
        let newPoint = {};
        // Just used as a shortcut
        let l = {
            data: this.bounds.largest,
            canvas: this.canvas.largest
        }
        let s = {
            data: this.bounds.shortest,
            canvas: this.canvas.shortest
        }

        // s.data = s.canvas; l.data = l.canvas
        // this.data[l.data].range = this.canvas
        let multiplier = (this.canvas[l.canvas] * (1 - this.padding)) / this.bounds[l.data].range;

        // Project the largest data side onto the largest canvas side
        newPoint[l.canvas == "height" ? "y" : "x"] = (this.bounds[l.data].max - point[l.data]) * multiplier;
        newPoint[s.canvas == "width" ? "x" : "y"] = (this.bounds[s.data].max - point[s.data]) * multiplier;
        
        // Flip if in certain orientation
        if (s.canvas == "width" && l.data == "lon") {
            newPoint.y = this.canvas.height - newPoint.y;
        }
        
        // Add padding
        newPoint[l.canvas == "height" ? "y" : "x"] += this.canvas[l.canvas] * (this.padding / 2) * (l.canvas == "height" ? -1 : 1);
        newPoint[s.canvas == "width" ? "x" : "y"] += (this.canvas[s.canvas] - (this.bounds[s.data].range * multiplier)) / 2;

        return newPoint;
    }

    draw() {
        this.ctx.strokeStyle = this.lineColor;
        this.ctx.lineWidth = this.lineWidth;
        for (let activity of this.activities) {
            this.ctx.beginPath();
            for (let point of activity) {
                let p = this.project(point);
                
                this.ctx.addPoint(p.x, p.y);
            }
            this.ctx.stroke();
        }
    }

    // Redoes all of the calculations and redraws
    refresh() {
        // Change the resolution of the canvas to match what it is
        this.canvas.height = this.canvas.offsetHeight * this.resolutionFactor;
        this.canvas.width = this.canvas.offsetWidth * this.resolutionFactor;

        // Work out the new longest and shortest sides of canvas
        this.canvas.largest = "";
        this.canvas.shortest = "";
        [this.canvas.largest, this.canvas.shortest] = this.canvas.height > this.canvas.width ? ["height", "width"] : ["width", "height"];
        
        this.calculateBounds();
        this.clearMap();
        this.draw();
    }

    // Converts the canvas to an image and downloads it
    download() {
        let el = document.createElement("a");
        el.classList.add("hidden");
        el.href = this.canvas.toDataURL("image/png").replace(/^data:image\/[^;]*/, "data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename=download.png");
        el.setAttribute("download", "download.png");
        document.body.appendChild(el);
        el.click();
        document.body.removeChild(el);
    }

    // Heavily based off https://github.com/mapbox/polyline/blob/master/src/polyline.js
    static polylineToGpx(polyline) {
        let i = 0;
        let lat = 0;
        let lon = 0;
        let coordinates = [];
        let latChange;
        let lonChange;

        // Start looping through characters
        while (i < polyline.length) {
            let byte = null;
            let shift = 0;
            let result = 0;

            // Latitude
            do {
                byte = polyline.charCodeAt(i++) - 63; // Convert character to useable set of bytes
                result |= (byte & 0x1f) << shift; // Remove highest bit and combine bites
                shift += 5; // Set offset for next byte
            } while (byte >= 0x20); // Repeat while high bit is on

            // If the low bit is set, right shift and inverse, or just right shift
            latChange = result & 1 ? ~(result >> 1) : result >> 1;


            shift = 0;
            result = 0;

            // Repeat for longitude
            do {
                byte = polyline.charCodeAt(i++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);

            lonChange = result & 1 ? ~(result >> 1) : result >> 1;

            lat += latChange;
            lon += lonChange;

            // Add coordinates
            coordinates.push({lat: lat / 100000, lon: lon / 100000});
        }

        return coordinates;
    }
}