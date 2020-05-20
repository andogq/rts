// Imports
const http = require("http");
const url = require("url");
const fs = require("fs");

class Server {
    constructor(port, staticDir) {
        this.port = port == undefined ? 8000 : port;
        this.staticDir = staticDir == undefined ? "static" : staticDir;

        this.server = http.createServer(this.incomingRequest.bind(this));

        this.functions = {};
    }
    
    start() {
        return new Promise((resolve, reject) => {
            console.log(`Searching for static files in directory ${this.staticDir}`);
            this.findStaticFiles().then(() => {
                console.log(`Starting server on port ${this.port}`);
                this.server.listen(this.port);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    findFiles(directory) {
        return new Promise((resolve, reject) => {
            fs.readdir(directory, {withFileTypes: true}, (err, contents) => {
                if (err) reject(err);
                let files = [];
                let promises = [];

                // Go through all the returned files
                contents.forEach((file) => {
                    let fileName = `${directory}/${file.name}`
                    // Add it to the list if it's a normal file
                    if (file.isFile()) files.push(fileName);
                    // If it's a directory search it for files
                    else if (file.isDirectory()) promises.push(this.findFiles(fileName));
                });

                // If there's directories being searched
                if (promises.length > 0) {
                    promises.forEach((promise) => {
                        // For new files in each directory
                        promise.then((newFiles) => {
                            files = files.concat(newFiles.files);
                        });
                    });
                    
                    Promise.all(promises).then(() => {
                        resolve({files: files, dir: directory});
                    });
                }
                else resolve({files: files, dir: directory});
            });
        });
    }
        
    findStaticFiles() {
        return new Promise((resolve, reject) => {
            this.findFiles(this.staticDir).then(({files}) => {
                // Remove static directory from start of string
                this.staticFiles = files.map((file) => {
                    return file.replace(/^[^\s/\\]+\/(.+)$/, "$1");
                });
                resolve();
            }).catch(reject);
        });
    }

    // Adds a function to an end point
    addFunction(name, func) {
        this.functions[name] = func;
    }

    incomingRequest(request, response) {
        request.url = url.parse(request.url);
        request.url.pathname = request.url.pathname == "/" ? "index.html" : request.url.pathname.slice(1);
        
        // Promise allows asynchronous actions to take place and response to be sent in one place
        new Promise((resolve, reject) => {
            if (this.staticFiles.indexOf(request.url.pathname) > -1) {
                // Static file requested
                fs.readFile(`${this.staticDir}/${request.url.pathname}`, (err, file) => {
                    if (err) reject(err);
                    let fileType = request.url.pathname.match(/^.+?\.([\w\d]+)$/)[1];
                    let contentType;
                    switch (fileType) {
                        case "ttf":
                            contentType = "font/ttf";
                            break;
                        case "jpg":
                        case "jpeg":
                            contentType = "image/jpeg";
                            break;
                        case "svg":
                            contentType = "image/svg+xml";
                            break;
                        case "js":
                            contentType = "text/javascript";
                            break;
                        default:
                            contentType = `text/${fileType}`;
                            break;
                    }
                    fileType = fileType == "js" ? "javascript" : fileType;
                    resolve({statusCode: 200, data: file, headers: {"Content-Type": contentType}});
                });
            } else if (Object.keys(this.functions).indexOf(request.url.pathname) > -1) {
                this.functions[request.url.pathname](request).then(resolve);
            } else {
                // 404
                resolve({statusCode: 404});
            }
        }).then(({statusCode, data, cookies, headers}) => {
            // Send response
            console.log(`${statusCode}: ${request.url.path}`);
            response.statusCode = statusCode;

            // Adds any cookies that need to be added
            if (cookies != undefined) {
                let cookieArray = []
                for (let cookie of cookies) {
                    let expireString = cookie.expires != undefined ? `expires=${cookie.expires}` : "";
                    cookieArray.push(`${cookie.name}=${cookie.value}; ${expireString}`);
                }
                response.setHeader("Set-Cookie", cookieArray);
            }

            // Add any other headers
            if (headers != undefined) {
                Object.keys(headers).forEach((header) => {
                    response.setHeader(header, headers[header]);
                });
            }

            response.end(data);
        }).catch((err) => {
            throw err;
        });
    }
}

module.exports = Server;