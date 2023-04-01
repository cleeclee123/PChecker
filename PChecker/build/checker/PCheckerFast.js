"use-strict";
import http from "http";
import { ENUM_ProxyAnonymity, ENUM_FlaggedHeaderValues } from "./constants.js";
export class PCheckerFast {
    host_;
    port_;
    timeout_;
    options_;
    publicIPAddress_;
    timeoutsArray_;
    static kProxyJudgeURL = `http://myproxyjudgeclee.software/pj-cleeclee123.php`;
    constructor(host, port, timeout, publicIPAddress) {
        this.host_ = host;
        this.port_ = port;
        this.timeout_ = Number(timeout);
        this.options_ = {};
        this.timeoutsArray_ = [];
        this.publicIPAddress_ = publicIPAddress;
        this.options_ = {
            host: this.host_,
            port: Number(this.port_),
            method: "GET",
            path: PCheckerFast.kProxyJudgeURL,
        };
    }
    async httpRequest() {
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({}), this.timeout_));
        this.timeoutsArray_.push(timeoutPromise);
        const response = new Promise((resolve, reject) => {
            let startTime = new Date().getTime();
            http.get(this.options_, (res) => {
                let httpRequest = {};
                let body = [];
                res.on("data", (chunk) => {
                    body.push(chunk);
                });
                res.on("close", () => {
                    httpRequest.responseTime = new Date().getTime() - startTime;
                });
                res.on("end", () => {
                    try {
                        httpRequest.header = JSON.parse(Buffer.concat(body).toString());
                        let pipCount = 0;
                        let toFlag = [];
                        Object.keys(httpRequest.header).forEach(async (key) => {
                            if (key in ENUM_FlaggedHeaderValues) {
                                if (this.publicIPAddress_ !== undefined ||
                                    this.publicIPAddress_ !== {}) {
                                    if (String(httpRequest.header[key]) ===
                                        String(this.publicIPAddress_)) {
                                        pipCount++;
                                    }
                                }
                                else if (Object.keys(this.publicIPAddress_).length === 0 &&
                                    this.publicIPAddress_.constructor === Object) {
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
                        httpRequest.header = {};
                        console.log(`httpRequest JSON Parse Error: ${error}`);
                    }
                    resolve(httpRequest);
                });
                res.on("error", (error) => {
                    resolve({});
                    console.log(`httpRequest ON-Error: ${error}`);
                });
            });
        });
        // race between timeout and httpsCheck
        try {
            return await Promise.race([timeoutPromise, response]);
        }
        catch (error) {
            console.log(`httpsCheck error in race: ${error}`);
            return {};
        }
    }
    // mem management
    clearTimeouts() {
        this.timeoutsArray_.forEach(async (to) => {
            clearTimeout(await to);
        });
    }
    async check() {
        let res = await this.httpRequest();
        this.clearTimeouts();
        return res;
    }
}
