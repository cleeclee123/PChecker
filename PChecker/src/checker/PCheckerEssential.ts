"use-strict";

import http from "http";
import net from "net";
import { PCheckerBase } from "./PCheckerBase.js";
import { ProxyInfoEssential, ProxyError, PCheckerOptions } from "./types.js";
import {
  ENUM_FlaggedHeaderValues,
  ENUM_ProxyAnonymity,
  ENUM_ERRORS,
  customEnumError,
} from "./emuns.js";

/**
 * @todo:
 *  - break all fat functions up
 *  - add constructor options for class (PCheckerBase, PCheckerEssential, PCheckerMethods)
 *  - write and deploy server
 *  - write tests/build out testing infrastructure
 */
export class PCheckerEssential extends PCheckerBase {
  private socketEssential_: net.Socket;
  private hasErrors_: boolean;

  constructor(pcheckerOptions?: PCheckerOptions) {
    super(pcheckerOptions);
    this.hasErrors_ = false;
  }

  private async checkProxyAnonymityEssential(): Promise<ProxyInfoEssential> {
    return new Promise<ProxyInfoEssential>(async (resolve, reject) => {
      const proxyInfo = {} as ProxyInfoEssential;
      proxyInfo.anonymity = "";

      const anonymityErrors: string[] = [];
      const startTime = new Date().getTime();

      if (this.publicIPAddress_ === undefined || this.publicIPAddress_ === "") {
        const tempPublicIP = await this.getPublicIP();
        if (
          tempPublicIP.hasOwnProperty("error") ||
          tempPublicIP.hasOwnProperty("timedout")
        ) {
          this.logger_.error(`checkProxyAnonymityEssential getPublicIP error`);
          resolve({
            errors: [
              customEnumError(
                "ANONYMITY_CHECK",
                ENUM_ERRORS.PUBLIC_IP_ADDRESS_ERROR
              ),
            ],
          } as ProxyInfoEssential);
        } else {
          this.publicIPAddress_ = String(tempPublicIP);
        }
      }
      // this.logger_.info(`public ip address: ${this.publicIPAddress_}`);

      const httpGetRequestObject = () => {
        const httpProxyRequestObject = http.get(this.optionspj_, (res) => {
          if (res.statusCode !== 200) {
            anonymityErrors.push(
              customEnumError("ANONYMITY_CHECK", ENUM_ERRORS.STATUS_CODE_ERROR)
            );
            this.logger_.error(
              `checkProxyAnonymity status code: ${res.statusCode}`
            );
            res.destroy();
          }

          // push data into buffer
          let body = [] as any[];
          res.on("data", (chunk) => {
            body.push(chunk);
          });

          // done buffering response
          res.on("end", () => {
            try {
              const headers = JSON.parse(Buffer.concat(body).toString());
              // this.logger_.info(`pj res: ${JSON.stringify(headers)}`);

              // count time that public ip address appers in header
              let pipCount = 0;
              let toFlag: any[] = [];
              let proxyInfoAnonymity;

              if (
                this.publicIPAddress_ !== undefined &&
                this.publicIPAddress_ !== ({} as any)
              ) {
                for (const key of Object.keys(headers)) {
                  if (key in ENUM_FlaggedHeaderValues) {
                    if (
                      String(headers[key as keyof JSON]) ===
                      this.publicIPAddress_
                    ) {
                      pipCount++;
                    }
                    toFlag.push(key);
                  }
                }

                proxyInfoAnonymity =
                  pipCount === 0
                    ? ENUM_ProxyAnonymity.Anonymous
                    : ENUM_ProxyAnonymity.Transparent;
              } else if (
                Object.keys(this.publicIPAddress_).length === 0 &&
                this.publicIPAddress_.constructor === Object
              ) {
                proxyInfoAnonymity = undefined;
              } else {
                proxyInfoAnonymity = ENUM_ProxyAnonymity.Elite;
              }

              proxyInfo.anonymity =
                toFlag.length === 0
                  ? ENUM_ProxyAnonymity.Elite
                  : proxyInfoAnonymity;
            } catch (error) {
              anonymityErrors.push(
                customEnumError("ANONYMITY_CHECK", ENUM_ERRORS.JSON_PARSE_ERROR)
              );
              this.logger_.error(
                `checkProxyAnonymity JSON parse error: ${error}`
              );
            }
            res.destroy();
          });

          res.on("error", (error) => {
            anonymityErrors.push(
              customEnumError("ANONYMITY_CHECK", ENUM_ERRORS.SOCKET_ERROR)
            );
            this.logger_.error(`checkProxyAnonymity socket error: ${error}`);
            res.destroy();
            // errorCallback(error, null, res);
          });

          res.on("close", () => {
            proxyInfo.judgeServerRes = new Date().getTime() - startTime;
            if (anonymityErrors.length !== 0) {
              this.hasErrors_ = true;
              proxyInfo.errors = anonymityErrors;
            }

            // the proxy judge is expected to work
            if (
              anonymityErrors.indexOf(
                `ANONYMITY_CHECK_${ENUM_ERRORS.STATUS_CODE_ERROR}`
              ) !== -1
            ) {
              reject({} as ProxyInfoEssential);
            } else {
              resolve(proxyInfo);
            }
          });
        });

        httpProxyRequestObject.on("error", (error) => {
          this.logger_.error(`checkProxyAnonymity socket hang up error`);
          anonymityErrors.push(
            customEnumError("ANONYMITY_CHECK", ENUM_ERRORS.SOCKET_HANG_UP)
          );
          httpProxyRequestObject.destroy();
        });

        httpProxyRequestObject.on("end", () => {
          proxyInfo.anonymity = undefined;
        });

        httpProxyRequestObject.on("close", () => {
          proxyInfo.judgeServerRes = new Date().getTime() - startTime;
          if (anonymityErrors.length !== 0) {
            this.hasErrors_ = true;
            proxyInfo.errors = anonymityErrors;
          }
          resolve(proxyInfo);
        });

        httpProxyRequestObject.end();

        return httpProxyRequestObject;
      };

      httpGetRequestObject();
    });
  }

  private async checkProxyHTTPS(): Promise<ProxyInfoEssential> {
    return new Promise<ProxyInfoEssential>((resolve) => {
      const proxyInfo = {} as ProxyInfoEssential;
      proxyInfo.httpConnectRes = -1;

      let response: string;
      let statusCode: string;
      let didConnect: boolean = false;

      const httpsErrors: string[] = [];
      const startTime = new Date().getTime();
      const buffers = [] as Buffer[];
      let buffersLength: number = 0;

      const socketConnect = () => {
        this.socketEssential_ = net.connect({
          host: this.host_,
          port: Number(this.port_),
        });

        // requests a http tunnel to be open https://en.wikipedia.org/wiki/HTTP_tunnel
        const payload = `CONNECT ${this.host_}:${Number(
          this.port_
        )} HTTP/1.1\r\n`;

        this.socketEssential_.on("connect", () => {
          didConnect = true;
          this.socketEssential_.write(`${payload}\r\n`);
          this.logger_.info(`https connncted`);
        });

        // dont need to buffer any traffic before proxy connect
        // onData will reject all non-200 res from server =>
        // meaning/confirming server has no https support
        onData();

        // check response at socket end
        this.socketEssential_.on("end", () => {
          // handle empty response here
          this.logger_.info(
            `checkProxyHTTPS empty response: https may be not supported`
          );
          if (
            proxyInfo.https === undefined ||
            response === undefined ||
            statusCode === undefined
          ) {
            proxyInfo.https = undefined;
          }

          // 204 (No Content) status code indicates that the server has successfully
          // fulfilled the request (HTTP CONNECT) and that there is no additional content
          // to send in the response payload body
          if (didConnect) {
            statusCode = "204";
            this.logger_.info(
              "checkProxyHTTPS no content - should have sent 204 status code"
            );
          }
        });

        // resolve when socket is close, we destory after seeing sucessful status code
        this.socketEssential_.on("close", () => {
          proxyInfo.httpConnectRes = new Date().getTime() - startTime;
          if (httpsErrors.length !== 0) {
            this.hasErrors_ = true;
            proxyInfo.errors = httpsErrors;
          }

          resolve(proxyInfo);
        });

        // todo: better/more specifc error handling
        this.socketEssential_.on("error", (error) => {
          httpsErrors.push(ENUM_ERRORS.SOCKET_ERROR);
          this.logger_.error(`getProxyLocation connect error: ${error}`);

          this.socketEssential_.destroy();
        });
      };

      // shamelessly taken from:
      // https://github.com/TooTallNate/node-https-proxy-agent/blob/master/src/parse-proxy-response.ts
      const onData = () => {
        this.socketEssential_.on("data", (chuck: Buffer) => {
          // console.log(chuck.toLocaleString());
          buffers.push(chuck);
          buffersLength += chuck.length;

          const buffered = Buffer.concat(buffers, buffersLength);
          const endOfHeaders = buffered.indexOf("\r\n\r\n");

          // will contine to buffer
          if (endOfHeaders === -1) {
            return;
          }

          // parse actual response, usually something like: "HTTP/1.1 200 Connection established"
          response = buffered.toString("ascii", 0, buffered.indexOf("\r\n"));

          // parse status code from response
          statusCode = String(+response.split(" ")[1]);

          // 403 status code may hint at https support with auth
          // 500 status code may hint at https support
          this.logger_.info(`checkProxyHTTPS statusCode: ${statusCode}`);
          if (statusCode === "403" || statusCode === "401")
            this.logger_.warn(`auth may be required`);
          else if (statusCode[0] === "4")
            this.logger_.warn(`not support generally`);
          else if (statusCode[0] === "5")
            this.logger_.warn(`proxy server error, probably no https support`);

          // check if digit of status code from CONNECT request
          if (statusCode[0] === "2") proxyInfo.https = true;
          else proxyInfo.https = false;

          this.socketEssential_.destroy();
        });
      };

      socketConnect();
    });
  }

  private async getProxyLocation(): Promise<ProxyInfoEssential> {
    return new Promise<ProxyInfoEssential>((resolve) => {
      const proxyInfo = {} as ProxyInfoEssential;
      proxyInfo.countryCode = "";

      const locationErrors: string[] = [];
      const startTime = new Date().getTime();

      const requestOptions = {
        host: this.host_,
        port: Number(this.port_),
        path: `http://ip-api.com/json/${this.host_}`,
        headers: {
          "User-Agent":
            PCheckerEssential.kUserAgents[
              Math.floor(Math.random() * PCheckerEssential.kUserAgents.length)
            ],
        },
      };

      const httpGetRequestObject = () => {
        const httpProxyRequestObject = http.get(requestOptions, (res) => {
          if (res.statusCode !== 200) {
            locationErrors.push(
              customEnumError("GET_LOCATION", ENUM_ERRORS.STATUS_CODE_ERROR)
            );
            this.logger_.error(
              `getProxyLocation bad status code: ${res.statusCode}`
            );
            res.destroy();
          }

          res.setEncoding("utf8");
          let responseData = [] as string[];
          res.on("data", (data) => {
            responseData.push(data);
          });

          res.on("end", () => {
            try {
              const json: any = JSON.parse(responseData.join(""));
              if (json.hasOwnProperty("countryCode")) {
                proxyInfo.countryCode = json.countryCode;
                res.destroy();
              } else {
                locationErrors.push(ENUM_ERRORS.GEO_LOCATION_ERROR);
                this.logger_.error(`getProxyLocation doesnt have county code`);
                res.destroy();
              }
            } catch (error) {
              locationErrors.push(
                customEnumError("GET_LOCATION", ENUM_ERRORS.JSON_PARSE_ERROR)
              );
              this.logger_.error(`getProxyLocation JSON Parse Error`);
              res.destroy();
            }
          });

          res.on("error", (error) => {
            locationErrors.push(
              customEnumError("GET_LOCATION", ENUM_ERRORS.CONNECTION_ERROR)
            );
            this.logger_.error(`getProxyLocation connect error: ${error}`);
            res.destroy();
          });

          res.on("close", () => {
            const endtime = new Date().getTime() - startTime;
            this.logger_.info(`getProxyLocation response time: ${endtime} ms`);
            if (locationErrors.length !== 0) {
              this.hasErrors_ = true;
              proxyInfo.errors = locationErrors;
            }

            resolve(proxyInfo);
          });
        });

        httpProxyRequestObject.on("error", (error) => {
          this.logger_.error(`GET_LOCATION socket hang up error`);
          locationErrors.push(
            customEnumError("GET_LOCATION", ENUM_ERRORS.SOCKET_HANG_UP)
          );
          const endtime = new Date().getTime() - startTime;
          this.logger_.info(`getProxyLocation error time: ${endtime} ms`);

          httpProxyRequestObject.destroy();
        });

        httpProxyRequestObject.on("end", () => {
          proxyInfo.anonymity = undefined;
        });

        httpProxyRequestObject.on("close", () => {
          if (locationErrors.length !== 0) {
            this.hasErrors_ = true;
            proxyInfo.errors = locationErrors;
          }
          resolve(proxyInfo);
        });

        httpProxyRequestObject.end();

        return httpProxyRequestObject;
      };

      httpGetRequestObject();
    });
  }

  /**
   * @method: checkProxyEssential(),
   * @returns: Promise<Object | Error>
   * Check essential proxy info
   */
  public async checkProxyEssential(): Promise<ProxyInfoEssential | ProxyError> {
    const timeoutPromise: Promise<ProxyError> = this.createTimeout("timedout");

    // race between timeout and promises
    try {
      let promises: Promise<ProxyInfoEssential>[] = [
        this.checkProxyAnonymityEssential(),
        this.checkProxyHTTPS(),
        this.getProxyLocation(),
      ];

      // run location as default
      if (this.runProxyLocation_ === false) promises.pop();

      const race = await Promise.race([timeoutPromise, Promise.all(promises)]);
      if (race.hasOwnProperty("timeoutdata")) {
        return race as ProxyError;
      }

      const results = race as ProxyInfoEssential[];
      const validResults = results.filter(
        (result) => !(result instanceof Error)
      );

      // allow to handle multiple errors
      const allErrors: string[] = [];

      // no need to iterate thru validResults if there are no errors
      // return object will not have errors property
      if (this.hasErrors_) {
        validResults.forEach((result) => {
          if (result.hasOwnProperty("errors")) {
            allErrors.push(...result.errors);
          }
          result.errors = undefined;
        });
      }

      const essentialInfo: ProxyInfoEssential = Object.assign(
        {},
        validResults[0],
        validResults[1],
        validResults[2]
      );
      essentialInfo.proxyString = `${this.host_}:${this.port_}`;
      if (allErrors.length !== 0) essentialInfo.errors = allErrors;

      return essentialInfo;
    } catch (error) {
      this.logger_.error(`checkProxyEssential error: ${error}`);
      return { error: ENUM_ERRORS.PROMISE_RACE_ERROR } as ProxyError;
    }
  }
}
