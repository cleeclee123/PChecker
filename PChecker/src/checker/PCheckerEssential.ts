"use-strict";

import http from "http";
import net from "net";
import { PCheckerBase } from "./PCheckerBase.js";
import { ProxyInfoEssential, PCheckerOptions } from "./types.js";
import {
  ProxyAnonymityEnum,
  ErrorsEnum,
  customEnumError,
} from "./emuns.js";

/**
 * @todo:
 *  - testing infra
 *  - closures clean up
 *  - other optimizations
 */
export class PCheckerEssential extends PCheckerBase {
  private socketEssential_: net.Socket;
  private hasErrors_: boolean;

  constructor(pcheckerOptions?: PCheckerOptions) {
    super(pcheckerOptions);
    this.hasErrors_ = false;
  }

  // seperate to test
  private parseHeaders(
    body: any[],
    proxyInfo: ProxyInfoEssential,
    errors: string[]
  ): void {
    try {
      const headers = JSON.parse(Buffer.concat(body).toString());
      this.logger_.info(`pj res: ${JSON.stringify(headers)}`);

      // count time that public ip address appers in header
      let pipCount = 0;
      let toFlag: any[] = [];
      let proxyInfoAnonymity:
        | ProxyAnonymityEnum.Transparent
        | ProxyAnonymityEnum.Anonymous
        | ProxyAnonymityEnum.Elite;

      if (
        this.publicIPAddress_ !== undefined &&
        this.publicIPAddress_ !== ({} as any)
      ) {
        for (const key of Object.keys(headers)) {
          if (this.kFlaggedHeaderValuesSet.has(key)) {
            if (String(headers[key as keyof JSON]) === this.publicIPAddress_) {
              pipCount++;
            }
            toFlag.push(key);
          }
        }

        proxyInfoAnonymity =
          pipCount === 0
            ? ProxyAnonymityEnum.Anonymous
            : ProxyAnonymityEnum.Transparent;
      } else if (
        Object.keys(this.publicIPAddress_).length === 0 &&
        this.publicIPAddress_.constructor === Object
      ) {
        proxyInfoAnonymity = undefined;
      } else {
        proxyInfoAnonymity = ProxyAnonymityEnum.Elite;
      }

      proxyInfo.anonymity =
        toFlag.length === 0 ? ProxyAnonymityEnum.Elite : proxyInfoAnonymity;

      this.logger_.info(`flagged header properties: ${toFlag}`);
    } catch (error) {
      errors.push(
        customEnumError("ANONYMITY_CHECK", ErrorsEnum.JSON_PARSE_ERROR)
      );
      this.logger_.error(`checkProxyAnonymity JSON parse error: ${error}`);
    }
  }

  private httpRequestCleanup(
    httpReqObj: http.ClientRequest,
    proxyInfo: ProxyInfoEssential,
    errors: string[],
    customErrMes: string,
    functionName: string
  ) {
    // handles socket hang up error and closes socket
    httpReqObj.on("error", (error) => {
      this.logger_.error(`${functionName} socket hang up error`);
      errors.push(customErrMes);
      httpReqObj.destroy();
    });

    httpReqObj.on("close", () => {
      if (errors.length !== 0) {
        this.hasErrors_ = true;
        proxyInfo.errors = errors;
      }
    });

    httpReqObj.end();

    return httpReqObj;
  }

  private async checkProxyAnonymityEssential(): Promise<ProxyInfoEssential> {
    return new Promise<ProxyInfoEssential>(async (resolve, reject) => {
      const proxyInfo = {} as ProxyInfoEssential;
      proxyInfo.anonymity = "";

      const anonymityErrors: string[] = [];
      const startTime = new Date().getTime();

      // checks if public ip address is already pass in, gets IP of client
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
                ErrorsEnum.PUBLIC_IP_ADDRESS_ERROR
              ),
            ],
          } as ProxyInfoEssential);
        } else {
          this.publicIPAddress_ = String(tempPublicIP);
          this.logger_.info(`public ip address: ${this.publicIPAddress_}`)
        }
      }

      const httpGetRequestObject = () => {
        const httpProxyRequestObject = http.get(
          this.optionspjExpressApp_,
          (res) => {
            if (res.statusCode !== 200) {
              anonymityErrors.push(
                customEnumError("ANONYMITY_CHECK", ErrorsEnum.STATUS_CODE_ERROR)
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
              this.parseHeaders(body, proxyInfo, anonymityErrors);
              res.destroy();
            });

            res.on("error", (error) => {
              anonymityErrors.push(
                customEnumError("ANONYMITY_CHECK", ErrorsEnum.SOCKET_ERROR)
              );
              this.logger_.error(`checkProxyAnonymity socket error: ${error}`);
              res.destroy();
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
                  `ANONYMITY_CHECK_${ErrorsEnum.STATUS_CODE_ERROR}`
                ) !== -1
              ) {
                reject({
                  judgeError: ErrorsEnum.PROXY_JUDGE_ERROR,
                } as ProxyInfoEssential);
              } else {
                resolve(proxyInfo);
              }
            });
          }
        );

        this.httpRequestCleanup(
          httpProxyRequestObject,
          proxyInfo,
          anonymityErrors,
          `ANONYMITY_CHECK_${ErrorsEnum.SOCKET_ERROR}`,
          "checkProxyAnonymityEssential"
        );
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
          httpsErrors.push(
            customEnumError("HTTPS_CHECK", ErrorsEnum.SOCKET_ERROR)
          );
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
              customEnumError("GET_LOCATION", ErrorsEnum.STATUS_CODE_ERROR)
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
                locationErrors.push(ErrorsEnum.GEO_LOCATION_ERROR);
                this.logger_.error(`getProxyLocation doesnt have county code`);
                res.destroy();
              }
            } catch (error) {
              locationErrors.push(
                customEnumError("GET_LOCATION", ErrorsEnum.JSON_PARSE_ERROR)
              );
              this.logger_.error(`getProxyLocation JSON Parse Error`);
              res.destroy();
            }
          });

          res.on("error", (error) => {
            locationErrors.push(
              customEnumError("GET_LOCATION", ErrorsEnum.CONNECTION_ERROR)
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

        this.httpRequestCleanup(
          httpProxyRequestObject,
          proxyInfo,
          locationErrors,
          `PROXY_LOCATION_ERROR_${ErrorsEnum.SOCKET_ERROR}`,
          "getProxyLocation"
        );
      };

      httpGetRequestObject();
    });
  }

  /**
   * @method: checkProxyEssential(),
   * @returns: Promise<Object | Error>
   * Check essential proxy info
   */
  public async checkProxyEssential(): Promise<ProxyInfoEssential> {
    const timeoutPromise: Promise<ProxyInfoEssential[]> = this.createTimeoutNew(
      [
        {
          timeoutError: ErrorsEnum.TIMEOUT,
          proxyString: `${this.host_}:${this.port_}`,
        } as ProxyInfoEssential,
      ] as ProxyInfoEssential[]
    );

    // race between timeout and promises
    try {
      let promises: Promise<ProxyInfoEssential>[];

      // run location as default
      if (this.runProxyLocation_) {
        promises = [
          this.checkProxyAnonymityEssential(),
          this.checkProxyHTTPS(),
          this.getProxyLocation(),
        ];
      } else {
        promises = [
          this.checkProxyAnonymityEssential(),
          this.checkProxyHTTPS(),
        ];
      }
      // console.log(promises.length);

      const race = await Promise.race([timeoutPromise, Promise.all(promises)]);
      if (race[0].hasOwnProperty("timeoutError")) {
        return race[0] as ProxyInfoEssential;
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
    } catch (error: any) {
      if (error.hasOwnProperty("judgeError")) {
        return {
          ...error,
          proxyString: `${this.host_}:${this.port_}`,
        } as ProxyInfoEssential;
      }

      return {
        unknownError: ErrorsEnum.UNKNOWN_ERROR,
        proxyString: `${this.host_}:${this.port_}`,
      } as ProxyInfoEssential;
    }
  }
}
