"use-strict";
import http from "http";
import { ENUM_ProxyAnonymity, ENUM_FlaggedHeaderValues, ENUM_ERRORS, } from "./constants.js";
import net from "net";
export class PCheckerFast {
    host_;
    port_;
    timeout_;
    options_;
    publicIPAddress_;
    auth_;
    timeoutsArray_;
    socket_;
    static kProxyJudgeURL = `http://myproxyjudgeclee.software/pj-cleeclee123.php`;
    constructor(host, port, timeout, publicIPAddress, username, password) {
        this.host_ = host;
        this.port_ = port;
        this.timeout_ = Number(timeout);
        this.options_ = {};
        this.timeoutsArray_ = [];
        // when i implement sign up/login, this will be saved and run only once everyday for every user
        publicIPAddress !== undefined
            ? (this.publicIPAddress_ = publicIPAddress)
            : (this.publicIPAddress_ = this.getPublicIPPromise());
        username !== undefined && password !== undefined
            ? (this.auth_ =
                "Basic " + Buffer.from(username + ":" + password).toString("base64"))
            : (this.auth_ = undefined);
        this.options_ = {
            host: this.host_,
            port: Number(this.port_),
            method: "GET",
            path: PCheckerFast.kProxyJudgeURL,
        };
        if (this.auth_ !== undefined) {
            this.options_.headers = { "Proxy-Authorization": this.auth_ };
        }
    }
    /**
     * @method: checkHTTP()
     * @returns Promise<ProxyInfo | Error>
     * connects to proxy judge through http proxy, strips and scans response headers, checks time to connect
     */
    async checkHTTPProxy() {
        const timeoutPromise = this.createTimeout();
        // kind slow, difference between response time of proxy connection and runtime is signficant if client ip address is not passed into constructor
        let resolvedPIP = await this.publicIPAddress_;
        const response = new Promise((resolve, reject) => {
            let httpRequest = {};
            let errorObject = {};
            let startTime = new Date().getTime();
            http.get(this.options_, (res) => {
                if (res.statusCode !== 200) {
                    console.log(`httpRequest Bad Status Code`);
                    errorObject.error = ENUM_ERRORS.StatusCodeError;
                    resolve(errorObject);
                }
                let body = [];
                res.on("data", (chunk) => {
                    body.push(chunk);
                });
                res.on("close", () => {
                    httpRequest.responseTime = new Date().getTime() - startTime;
                    res.destroy();
                });
                res.on("end", () => {
                    try {
                        httpRequest.header = JSON.parse(Buffer.concat(body).toString());
                        let pipCount = 0;
                        let toFlag = [];
                        Object.keys(httpRequest.header).forEach(async (key) => {
                            if (key in ENUM_FlaggedHeaderValues) {
                                if (resolvedPIP !== undefined ||
                                    resolvedPIP !== {}) {
                                    if (String(httpRequest.header[key]) ===
                                        String(resolvedPIP)) {
                                        pipCount++;
                                    }
                                }
                                else if (Object.keys(resolvedPIP).length === 0 &&
                                    resolvedPIP.constructor === Object) {
                                    httpRequest.anonymity = undefined;
                                }
                                pipCount === 0
                                    ? (httpRequest.anonymity = ENUM_ProxyAnonymity.Anonymous)
                                    : (httpRequest.anonymity = ENUM_ProxyAnonymity.Transparent);
                                toFlag.push(key);
                            }
                            httpRequest.cause = toFlag;
                            if (httpRequest.cause.length === 0) {
                                httpRequest.anonymity = ENUM_ProxyAnonymity.Elite;
                            }
                        });
                    }
                    catch (error) {
                        res.destroy();
                        console.log(`httpRequest JSON Parse Error: ${error}`);
                        errorObject.error = ENUM_ERRORS.JSONParseError;
                        resolve(errorObject);
                    }
                    resolve(httpRequest);
                });
                res.on("error", (error) => {
                    res.destroy();
                    console.log(`httpRequest ON-Error: ${error}`);
                    errorObject.error = ENUM_ERRORS.ConnectionError;
                    resolve(errorObject);
                });
            });
        });
        // race between timeout and httpsCheck
        try {
            return await Promise.race([timeoutPromise, response]);
        }
        catch (error) {
            console.log(`httpRequest PromiseRace Error: ${error}`);
            return { error: ENUM_ERRORS.PromiseRaceError };
        }
    }
    async checkHTTPSSupport() {
        const timeoutPromise = this.createTimeout();
        const bufferPromise = new Promise((resolve, reject) => {
            let httpsRequest = {};
            let startTime = new Date().getTime();
            let buffersLength = 0;
            const buffers = [];
            // create a socket connection to the proxy server
            const socketConnect = () => {
                this.socket_ = net.connect({
                    host: this.host_,
                    port: Number(this.port_),
                });
                // this is ugly, todo: fix all 
                onConnect();
                onData();
                onClose();
                onEnd();
                onError();
            };
            const onConnect = () => {
                // requests a http tunnel to be open https://en.wikipedia.org/wiki/HTTP_tunnel
                let payload = `CONNECT ${this.host_}:${Number(this.port_)} HTTP/1.1\r\n`;
                this.socket_.on("connect", () => {
                    this.socket_.write(`${payload}\r\n`);
                });
            };
            const onData = () => {
                this.socket_.on("data", (chuck) => {
                    console.log(chuck);
                    buffers.push(chuck);
                    buffersLength += chuck.length;
                    const buffered = Buffer.concat(buffers, buffersLength);
                    const endOfHeaders = buffered.indexOf("\r\n\r\n");
                    // will contine to buffer
                    if (endOfHeaders === -1) {
                        return;
                    }
                    // parse actual response, usually something like: "HTTP/1.1 200 Connection established"
                    httpsRequest.response = buffered.toString("ascii", 0, buffered.indexOf("\r\n"));
                    // parse status code from response
                    httpsRequest.statusCode = Number(+httpsRequest.response.split(" ")[1]);
                    // resolve right away if status code is not 200
                    if (httpsRequest.statusCode !== 200) {
                        resolve({ error: ENUM_ERRORS.StatusCodeError });
                    }
                });
            };
            const onClose = () => {
                this.socket_.on("close", () => {
                    httpsRequest.responseTime = new Date().getTime() - startTime;
                    this.socket_.destroy();
                });
            };
            const onEnd = () => {
                this.socket_.on("end", () => {
                    resolve(httpsRequest);
                });
            };
            const onError = () => {
                this.socket_.on("error", (error) => {
                    removeListeners();
                    this.socket_.destroy();
                    resolve({ error: ENUM_ERRORS.SocketError });
                });
            };
            const removeListeners = () => {
                this.socket_.removeListener("end", onEnd);
                this.socket_.removeListener("error", onError);
                this.socket_.removeListener("close", onClose);
            };
            // run
            socketConnect();
        });
        try {
            return await Promise.race([bufferPromise, timeoutPromise]);
        }
        catch (error) {
            console.log(`httpsCheck PromiseRace Error: ${error}`);
            return { error: ENUM_ERRORS.PromiseRaceError };
        }
    }
    getPublicIPPromise() {
        const timeoutPromise = this.createTimeout();
        const pipPromise = new Promise((resolve, reject) => {
            http.get({ host: "api.ipify.org", port: 80, path: "/" }, (resp) => {
                resp.on("data", (ip) => {
                    resolve(String(ip));
                });
                // clear
                resp.on("close", () => {
                    resp.destroy();
                });
                resp.on("error", (err) => {
                    resp.destroy();
                    console.log(`pip constructor ON-Error: ${err}`);
                    resolve({ error: ENUM_ERRORS.ConnectionError });
                });
            });
        });
        // abiding readiness pattern, returning a promise
        // not awaiting promise here will need to handle this in run()
        try {
            return Promise.race([pipPromise, timeoutPromise]);
        }
        catch (error) {
            this.publicIPAddress_ = new Promise((resolve) => {
                resolve({ error: ENUM_ERRORS.PromiseRaceError });
            });
        }
    }
    // function creates timeout, mem is managed by clearTimeouts()
    createTimeout() {
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({}), this.timeout_));
        this.timeoutsArray_.push(timeoutPromise);
        return timeoutPromise;
    }
    // mem management
    clear() {
        // timeout clear
        this.timeoutsArray_.forEach(async (to) => {
            clearTimeout(await to);
        });
    }
    async check() {
        let all = await Promise.all([this.checkHTTPProxy(), this.checkHTTPSSupport()]);
        this.clear();
        return all;
    }
}
