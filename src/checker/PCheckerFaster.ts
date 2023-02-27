"use-strict";

import http from "http";
import https from "https";
import { ENUM_ProxyAnonymity, ENUM_FlaggedHeaderValues } from "./constants.js";
import net from "net";
import os from "os";

type HTTPOptions = {
  host: string;
  port: number;
  method: string;
  path: string;
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

  public async httpRequest(): Promise<ProxyInfo> {
    const timeoutPromise: Promise<ProxyInfo> = new Promise((resolve) =>
      setTimeout(() => resolve({} as ProxyInfo), this.timeout_)
    );
    this.timeoutsArray_.push(timeoutPromise);

    const response: Promise<ProxyInfo> = new Promise((resolve, reject) => {
      let startTime = new Date().getTime();
      http.get(this.options_, (res) => {
        let httpRequest = {} as ProxyInfo;

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
            httpRequest.header = {} as JSON;
            console.log(`httpRequest JSON Parse Error: ${error}`);
          }

          resolve(httpRequest);
        });

        res.on("error", (error) => {
          resolve({} as ProxyInfo);
          console.log(`httpRequest ON-Error: ${error}`);
        });
      });
    });

    // race between timeout and httpsCheck
    try {
      return await Promise.race([timeoutPromise, response]);
    } catch (error) {
      console.log(`httpsCheck error in race: ${error}`);
      return {} as ProxyInfo;
    }
  }

  // mem management
  private clearTimeouts() {
    this.timeoutsArray_.forEach(async (to) => {
      clearTimeout(await to);
    });
  }

  public async check() {
    let res = await this.httpRequest();

    this.clearTimeouts();

    return res;
  }
}
