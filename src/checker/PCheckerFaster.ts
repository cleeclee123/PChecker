"use-strict";

import http from "http";
import {
  ENUM_ProxyAnonymity,
  ENUM_FlaggedHeaderValues,
  ENUM_ERRORS,
} from "./constants.js";
import net from "net";
import tls from "tls";

type ProxyOptions = {
  host: string;
  port: number;
  method: string;
  path: string;
  headers?: any;
};

type ProxyError = {
  error: ENUM_ERRORS;
};

type ProxyInfo = {
  header: JSON;
  responseTime: number;
  anonymity: ENUM_ProxyAnonymity;
  cause: string[];
};

export class PCheckerFast {
  public host_: string;
  public port_: string;
  public timeout_: number;
  public options_: ProxyOptions;
  private publicIPAddress_: string | Promise<string | ProxyError>;
  private timeoutsArray_: Array<any>;
  private auth_: string;

  static readonly kProxyJudgeURL: string = `http://myproxyjudgeclee.software/pj-cleeclee123.php`;

  constructor(
    host: string,
    port: string,
    timeout: string,
    publicIPAddress?: string | Promise<string | ProxyError>,
    username?: string,
    password?: string
  ) {
    this.host_ = host;
    this.port_ = port;
    this.timeout_ = Number(timeout);
    this.options_ = {} as ProxyOptions;
    this.timeoutsArray_ = [];

    // this is poop poop and ugly
    if (publicIPAddress !== undefined) {
      this.publicIPAddress_ = publicIPAddress; // optional parameter, getPIP() will be called if not passed in, readiness design pattern: puttnig a promise in the object
    }
    if (publicIPAddress === undefined) {
      const timeoutPromise: Promise<string> = this.createTimeout();
      const pipPromise: Promise<string | ProxyError> = new Promise(
        (resolve, reject) => {
          http.get({ host: "api.ipify.org", port: 80, path: "/" }, (resp) => {
            resp.on("data", (ip) => {
              resolve(String(ip));
            });

            resp.on("error", (err) => {
              console.log(`pip constructor ON-Error: ${err}`);
              resolve({ error: ENUM_ERRORS.ConnectionError } as ProxyError);
            });
          });
        }
      );

      // abiding readiness pattern, returning a promise
      // not awaiting promise here will need to handle this in run()
      try {
        this.publicIPAddress_ = Promise.race([pipPromise, timeoutPromise]);
      } catch (error) {
        this.publicIPAddress_ = new Promise((resolve) => {
          resolve({ error: ENUM_ERRORS.PromiseRaceError } as ProxyError);
        });
      }
    }

    // support for auth
    this.auth_ =
      "Basic " + Buffer.from(username + ":" + password).toString("base64");

    this.options_ = {
      host: this.host_,
      port: Number(this.port_),
      method: "GET",
      path: PCheckerFast.kProxyJudgeURL,
      headers: {
        "Proxy-Authorization": this.auth_,
      }, // todo: seperate headers from options for more control on what we are sending to proxy server
    };
  }

  /**
   * @method: checkHTTP()
   * @returns Promise<ProxyInfo | Error>
   * connects to proxy judge through http proxy, strips and scans response headers, checks time to connect
   */
  public async checkHTTPProxy(): Promise<ProxyInfo | ProxyError> {
    const timeoutPromise: Promise<ProxyInfo> = this.createTimeout();
    // kind slow, difference between response time of proxy connection and runtime is signficant if client ip address is not passed into constructor
    let resolvedPIP = await this.publicIPAddress_;

    const response: Promise<ProxyInfo | ProxyError> = new Promise(
      (resolve, reject) => {
        let httpRequest = {} as ProxyInfo;
        let errorObject = {} as ProxyError;
        let startTime = new Date().getTime();

        http.get(this.options_, (res) => {
          if (res.statusCode !== 200) {
            console.log(`httpRequest Bad Status Code`);
            errorObject.error = ENUM_ERRORS.StatusCodeError;

            resolve(errorObject);
          }

          let body = [] as any[];
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
              let toFlag: any[] = [];
              Object.keys(httpRequest.header).forEach(async (key) => {
                if (key in ENUM_FlaggedHeaderValues) {
                  if (
                    resolvedPIP !== undefined ||
                    resolvedPIP !== ({} as any)
                  ) {
                    if (
                      String(httpRequest.header[key as keyof JSON]) ===
                      String(resolvedPIP)
                    ) {
                      pipCount++;
                    }
                  } else if (
                    Object.keys(resolvedPIP).length === 0 &&
                    resolvedPIP.constructor === Object
                  ) {
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
            } catch (error) {
              console.log(`httpRequest JSON Parse Error: ${error}`);
              errorObject.error = ENUM_ERRORS.JSONParseError;
              resolve(errorObject);
            }

            resolve(httpRequest);
          });

          res.on("error", (error) => {
            console.log(`httpRequest ON-Error: ${error}`);
            errorObject.error = ENUM_ERRORS.ConnectionError;

            resolve(errorObject);
          });
        });
      }
    );

    // race between timeout and httpsCheck
    try {
      return await Promise.race([timeoutPromise, response]);
    } catch (error) {
      console.log(`httpRequest PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PromiseRaceError } as ProxyError;
    }
  }

  // function creates timeout, mem is managed by clearTimeouts()
  private createTimeout<T>() {
    const timeoutPromise: Promise<T> = new Promise((resolve) =>
      setTimeout(() => resolve({} as T), this.timeout_)
    );
    this.timeoutsArray_.push(timeoutPromise);

    return timeoutPromise;
  }

  // mem management
  private clearTimeouts() {
    this.timeoutsArray_.forEach(async (to) => {
      clearTimeout(await to);
    });
  }

  public async check() {
    let res = await this.checkHTTPProxy();

    this.clearTimeouts();

    return res;
  }
}
