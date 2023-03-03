"use-strict";

import http from "http";
import {
  ENUM_ProxyAnonymity,
  ENUM_FlaggedHeaderValues,
  ENUM_ERRORS,
} from "./constants.js";
import net from "net";
import tls from "tls";

type HTTPOptions = {
  host: string;
  port: number;
  method: string;
  path: string;
};

type Error = {
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
  public options_: HTTPOptions;
  private publicIPAddress_: string;
  private timeoutsArray_: Array<any>;

  static readonly kProxyJudgeURL: string = `http://myproxyjudgeclee.software/pj-cleeclee123.php`;

  constructor(
    host: string,
    port: string,
    timeout: string,
    publicIPAddress: string
  ) {
    this.host_ = host;
    this.port_ = port;
    this.timeout_ = Number(timeout);
    this.options_ = {} as HTTPOptions;
    this.timeoutsArray_ = [];
    this.publicIPAddress_ = publicIPAddress;

    this.options_ = {
      host: this.host_,
      port: Number(this.port_),
      method: "GET",
      path: PCheckerFast.kProxyJudgeURL,
    };
  }

  /**
   * @method: checkHTTP()
   * @returns Promise<ProxyInfo | Error>
   * connects to proxy judge through http proxy, strips and scans response headers, checks time to connect
   */
  public async checkHTTPProxy(): Promise<ProxyInfo | Error> {
    const timeoutPromise: Promise<ProxyInfo> = new Promise((resolve) =>
      setTimeout(() => resolve({} as ProxyInfo), this.timeout_)
    );
    this.timeoutsArray_.push(timeoutPromise);

    const response: Promise<ProxyInfo | Error> = new Promise(
      (resolve, reject) => {
        let httpRequest = {} as ProxyInfo;
        let errorObject = {} as Error;
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
                    this.publicIPAddress_ !== undefined ||
                    this.publicIPAddress_ !== ({} as any)
                  ) {
                    if (
                      String(httpRequest.header[key as keyof JSON]) ===
                      String(this.publicIPAddress_)
                    ) {
                      pipCount++;
                    }
                  } else if (
                    Object.keys(this.publicIPAddress_).length === 0 &&
                    this.publicIPAddress_.constructor === Object
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
      return { error: ENUM_ERRORS.PromiseRaceError } as Error;
    }
  }

  /**
   * @method: checkHTTPSSuport()
   * @returns
   * reference: https://github.com/TooTallNate/node-https-proxy-agent/blob/master/src/agent.ts#L192
   * a "mock" HTTP request will tunnel through proxy server by attempting to issue a HTTP CONNECT method to the proxy server
   * just need a boolean value to see if proxy supports https, no need to upgrade incoming requests to tls once/if connect method goes through
   */
  public async checkHTTPSSuport() {}

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
