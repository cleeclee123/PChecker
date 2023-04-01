"use strict";
import fetch from "node-fetch";
import { curlPingConfig, ENUM_ProxyAnonymity, ENUM_FlaggedHeaderValues, fetchConfig, } from "./constants.js";
import { spawn } from "child_process";
import pidusage from "pidusage";
import * as readline from "readline";
import http from "http";
import * as dotenv from "dotenv";
dotenv.config();
export class PChecker {
    host_;
    port_;
    timeout_;
    spawnProcesses_;
    timeoutsArray_;
    static kProxyJudgeURL = `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`;
    constructor(host, port, timeout) {
        this.host_ = host;
        this.port_ = port;
        this.timeout_ = Number(timeout);
        this.timeoutsArray_ = [];
        this.spawnProcesses_ = {};
        this.spawnProcesses_.httpsProcess_ =
            spawn("curl", [
                "-s",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                "-p",
                "-x",
                `http://${this.host_}:${this.port_}`,
                `${PChecker.kProxyJudgeURL}`,
            ], { timeout: this.timeout_ }) || {};
        this.spawnProcesses_.pingProcess_ =
            spawn("curl", [
                "-s",
                "-o",
                "/dev/null",
                "-w",
                curlPingConfig,
                "--proxy",
                `http://${this.host_}:${this.port_}`,
                `${PChecker.kProxyJudgeURL}`,
            ], { timeout: this.timeout_ }) || {};
        this.spawnProcesses_.proxyProcess_ =
            spawn("curl", [
                "-s",
                `-H`,
                `Proxy-Connection:`,
                "--proxy",
                `http://${this.host_}:${this.port_}`,
                `${PChecker.kProxyJudgeURL}`,
                `-v`,
            ], { timeout: this.timeout_ }) || {};
    }
    // https check
    async httpsCheck() {
        // timeout, race this condition with httpsCheck
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({}), this.timeout_));
        this.timeoutsArray_.push(timeoutPromise);
        let httpsCheck = {};
        const httpsCheckPromise = new Promise((resolve, reject) => {
            this.spawnProcesses_.httpsProcess_.stdout.on("data", (data) => {
                httpsCheck.status = String(data);
                // status 000, no response, curl over proxy
                if (data === "000") {
                    httpsCheck.https = undefined;
                }
                else if (Array.from(httpsCheck.status)[0] !== "2") {
                    httpsCheck.https = false;
                }
                else {
                    httpsCheck.https = true;
                }
                resolve(httpsCheck);
            });
            this.spawnProcesses_.httpsProcess_.stderr.on("data", (data) => {
                console.log(String(data));
            });
            // handle error, i dont want to reject because it stops program, expecting issues lol
            this.spawnProcesses_.httpsProcess_.on("error", (error) => {
                console.log(`https check: ${error}`);
                resolve(httpsCheck);
            });
            // handle exit
            this.spawnProcesses_.httpsProcess_.on("exit", (code) => {
                console.log(`httpsCheck exit code: ${code}`);
            });
        });
        // race between timeout and httpsCheck
        try {
            return await Promise.race([timeoutPromise, httpsCheckPromise]);
        }
        catch (error) {
            console.log(`httpsCheck error in race: ${error}`);
            return {};
        }
    }
    // ping check
    async pingCheck() {
        // timeout, race this condition with httpsCheck
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({}), this.timeout_));
        this.timeoutsArray_.push(timeoutPromise);
        let json = {};
        let pingObj = {};
        let str = "";
        const pingCheckPromise = new Promise((resolve, reject) => {
            this.spawnProcesses_.pingProcess_.stdout.on("data", (data) => {
                str += data.toString();
                try {
                    let arr = str.split(",");
                    arr.forEach((data) => {
                        let temp = data.split(":");
                        json[String(temp[0].replace(/\s+/g, ""))] = temp[1].replace(/\s+/g, "");
                    });
                    Object.assign(pingObj, json);
                    resolve(pingObj);
                }
                catch (error) {
                    console.log(`pingCheck error: ${error}`);
                    resolve(undefined);
                }
            });
            this.spawnProcesses_.pingProcess_.stderr.on("data", (data) => {
                // console.log(String(data));
            });
            this.spawnProcesses_.pingProcess_.on("exit", (code) => {
                console.log(`pingCheck cp exit code: ${code}`);
            });
        });
        // race between timeout and httpsCheck
        try {
            return await Promise.race([timeoutPromise, pingCheckPromise]);
        }
        catch (error) {
            console.log(`httpsCheck error in race: ${error}`);
            return {};
        }
    }
    // proxy check
    async proxyCheck() {
        let pCheck = {};
        let statusCheck = false;
        return new Promise(async (resolve, reject) => {
            // stream standard output (response from proxy judge here)
            this.spawnProcesses_.proxyProcess_.stdout.on("data", async (data) => {
                // statusCheck is calculated in the stderr block, looks at response header output
                if (!statusCheck) {
                    console.log("status check error");
                    resolve({});
                }
                // Strip/analyze headers here
                try {
                    pCheck.res = JSON.parse(await data.toString());
                    let publicIP = (await this.getPIP()) || {};
                    let pipCount = 0;
                    let toFlag = [];
                    Object.keys(pCheck.res).forEach(async (key) => {
                        if (key in ENUM_FlaggedHeaderValues) {
                            if (publicIP !== undefined || publicIP !== {}) {
                                if (String(pCheck.res[key]) === String(publicIP)) {
                                    pipCount++;
                                }
                            }
                            else if (Object.keys(publicIP).length === 0 &&
                                publicIP.constructor === Object) {
                                pCheck.anonymity = undefined;
                            }
                            pipCount === 0
                                ? (pCheck.anonymity = ENUM_ProxyAnonymity.Anonymous)
                                : (pCheck.anonymity = ENUM_ProxyAnonymity.Transparent);
                            toFlag.push(key);
                        }
                        pCheck.cause = toFlag;
                        if (pCheck.cause.length === 0) {
                            pCheck.anonymity = ENUM_ProxyAnonymity.Elite;
                        }
                    });
                    resolve(pCheck);
                }
                catch (error) {
                    console.log(`curlProxy error: ${error}`);
                }
            });
            // stream standard error, this is stream first anyway
            // // request/response headers are streamed here (curl -v flag)
            let lineCount = 0;
            let reqHeaders = {};
            const rlStderr = readline.createInterface({
                input: this.spawnProcesses_.proxyProcess_.stderr,
            });
            for await (const line of rlStderr) {
                // console.log(line);
                lineCount++;
                // resolve undefined in the middle of the stream if connection request fails
                if (lineCount === 2 &&
                    line.indexOf(`* Connected to ${this.host_}`) === -1) {
                    // kill readline
                    rlStderr.close();
                    rlStderr.removeAllListeners();
                    console.log("connection error");
                    resolve(undefined);
                }
                // sucessful response check, read before try parse json response
                if (line.indexOf(`< HTTP/1.1 200 OK`) !== -1) {
                    statusCheck = true;
                }
                // ">" curl request headers display, "<" curl response header display
                // i removed
                if (line.indexOf(`< Via:`) !== -1) {
                    pCheck.anonymity = ENUM_ProxyAnonymity.Anonymous;
                }
                // add to request headers
                if (line.indexOf(`> `) !== -1 && line.indexOf(`GET`) === -1) {
                    let kv = line.slice(2).split(":");
                    reqHeaders[`${kv[0]}`] = kv[1];
                }
            }
            try {
                pCheck.req = JSON.parse(JSON.stringify(reqHeaders));
            }
            catch (error) {
                console.log("json parse error");
                pCheck.req = reqHeaders;
            }
            rlStderr.close();
            rlStderr.removeAllListeners();
            // handle error
            this.spawnProcesses_.proxyProcess_.on("error", (error) => {
                console.log(`curl proxy error: ${error}`);
            });
            // handle spawn exit
            this.spawnProcesses_.proxyProcess_.on("exit", async (code) => {
                console.log(`proxyCheck cp exit: ${code}`);
                if (code === null) {
                    console.log(`proxyCheck timeout`);
                    resolve({});
                }
                if (code !== 0) {
                    reject(new Error(`proxyCheck cp error`));
                }
            });
        });
    }
    // google check
    async checkGoogle() {
        try {
            let res = await fetch(`https://www.google.com/`, fetchConfig(this.host_, this.port_, this.timeout_)["config"]);
            this.timeoutsArray_.push(fetchConfig(this.host_, this.port_, this.timeout_)["timeoutId"]);
            clearTimeout(fetchConfig(this.host_, this.port_, this.timeout_)["timeoutId"]);
            if (res.status === 200) {
                return true;
            }
            return false;
        }
        catch (error) {
            console.log(`google error: ${error}`);
            return false;
        }
    }
    // location check
    async getLocation() {
        try {
            let status = {};
            let response = await fetch(`http://ip-api.com/json/`, fetchConfig(this.host_, this.port_, this.timeout_)["config"]);
            this.timeoutsArray_.push(fetchConfig(this.host_, this.port_, this.timeout_)["timeoutId"]);
            clearTimeout(fetchConfig(this.host_, this.port_, this.timeout_)["timeoutId"]);
            if (response.status !== 200) {
                console.log("getLocation status error");
                return undefined;
            }
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") === -1) {
                console.log("response is not json");
            }
            const isAnonymousCallBack = async () => {
                return this.getPIP().then((publicip) => {
                    if (String(data["query"]) !== publicip) {
                        return true;
                    }
                    return false;
                });
            };
            let data = await response.json();
            if (this.host_ === String(data["query"]) ||
                (await isAnonymousCallBack())) {
                // assignment is a bit redunant, todo: switch to interface and cast
                status.country = String(data["country"]);
                status.region = String(data["regionName"]);
                status.city = String(data["city"]);
                status.zip = String(data["zip"]);
                status.location = {
                    lat: String(data["lat"]),
                    long: String(data["lon"]),
                };
                status.tz = String(data["timezone"]);
                status.isp = String(data["isp"]);
                return status;
            }
            return status;
        }
        catch (error) {
            console.log(`getLocation error: ${error}`);
            return {};
        }
    }
    async getPIP() {
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve({});
            }, this.timeout_);
        });
        this.timeoutsArray_.push(timeoutPromise);
        const publicIPPromise = new Promise((resolve, reject) => {
            http.get({ host: "api.ipify.org", port: 80, path: "/" }, function (resp) {
                resp.on("data", function (ip) {
                    resolve(String(ip));
                });
            });
        });
        return Promise.race([publicIPPromise, timeoutPromise]);
    }
    // just logs info
    getProcessInfo() {
        pidusage(this.spawnProcesses_.httpsProcess_.pid, (error, stats) => {
            console.log(stats);
            console.log(error);
        });
        pidusage(this.spawnProcesses_.pingProcess_.pid, (error, stats) => {
            console.log(stats);
            console.log(error);
        });
        pidusage(this.spawnProcesses_.proxyProcess_.pid, (error, stats) => {
            console.log(stats);
            console.log(error);
        });
    }
    // mem management
    clearTimeouts() {
        this.timeoutsArray_.forEach(async (to) => {
            clearTimeout(await to);
        });
    }
    // mem management
    destroy() {
        this.spawnProcesses_.httpsProcess_.removeAllListeners();
        this.spawnProcesses_.httpsProcess_.stdout.destroy();
        this.spawnProcesses_.httpsProcess_.stderr.destroy();
        this.spawnProcesses_.httpsProcess_.kill("SIGKILL");
        this.spawnProcesses_.pingProcess_.removeAllListeners();
        this.spawnProcesses_.pingProcess_.stdout.destroy();
        this.spawnProcesses_.pingProcess_.stderr.destroy();
        this.spawnProcesses_.pingProcess_.kill("SIGKILL");
        this.spawnProcesses_.proxyProcess_.removeAllListeners();
        this.spawnProcesses_.proxyProcess_.stdout.destroy();
        this.spawnProcesses_.proxyProcess_.stderr.destroy();
        this.spawnProcesses_.proxyProcess_.kill("SIGKILL");
    }
    async check() {
        // this.getProcessInfo();
        let all = await Promise.all([
            this.httpsCheck(),
            this.pingCheck(),
            this.proxyCheck(),
            this.checkGoogle(),
            this.getLocation(),
        ]);
        let checker = {};
        checker.httpsCheck = all[0];
        checker.pingCheck = all[1];
        checker.proxyCheck = all[2];
        checker.googleCheck = all[3];
        checker.location = all[4];
        // memory management
        this.clearTimeouts();
        this.destroy();
        return checker;
    }
}
