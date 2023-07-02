"use-strict";

import http from "http";
import net from "net";
import { PCheckerBase } from "./PCheckerBase.js";
import { ProxyInfoEssential, PCheckerOptions } from "./types.js";
import { ProxyAnonymityEnum, ErrorsEnum, customEnumError } from "./emuns.js";

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

      let myPublicIPAddressCount = 0;
      let flaggedHeadersCount = 0;
      const toFlag: any[] = [];

      for (const key of Object.keys(headers)) {
        if (this.kFlaggedHeaderValuesSet.has(key)) {
          flaggedHeadersCount++;
          if (String(headers[key as keyof JSON]) === this.publicIPAddress_) {
            myPublicIPAddressCount++;
          }
          toFlag.push(key);
        }
      }

      // check if flagged header properties exist
      proxyInfo.anonymity =
        flaggedHeadersCount === 0
          ? ProxyAnonymityEnum.Elite
          : ProxyAnonymityEnum.Anonymous;

      // check if public ip is shown
      proxyInfo.anonymity =
        myPublicIPAddressCount === 0
          ? ProxyAnonymityEnum.Anonymous
          : ProxyAnonymityEnum.Transparent;

      this.logger_.info(`flagged header properties: ${toFlag}`);
    } catch (error) {
      proxyInfo.anonymity = undefined;
      this.hasErrors_ = true;
      errors.push(
        customEnumError("ANONYMITY_CHECK", ErrorsEnum.JSON_PARSE_ERROR)
      );
      this.logger_.error(`checkProxyAnonymity JSON parse error: ${error}`);
    }
  }

  private async checkProxyAnonymityEssential(): Promise<ProxyInfoEssential> {
    return new Promise<ProxyInfoEssential>(async (resolve, reject) => {
      const proxyInfo = {} as ProxyInfoEssential;
      proxyInfo.anonymity = ProxyAnonymityEnum.Unknown;

      const anonymityErrors: string[] = [];
      const startTime = new Date().getTime();

      // checks if public ip address is already pass in, gets IP of client
      if (this.publicIPAddress_ === undefined || this.publicIPAddress_ === "") {
        const tempPublicIP = await this.getPublicIP();

        if (tempPublicIP.hasOwnProperty("error")) {
          this.logger_.error(`checkProxyAnonymityEssential getPublicIP error`);
          proxyInfo.errors = [
            customEnumError(
              "ANONYMITY_CHECK",
              ErrorsEnum.PUBLIC_IP_ADDRESS_ERROR
            ),
          ];
          resolve(proxyInfo);
        } else {
          this.publicIPAddress_ = String(tempPublicIP);
          this.logger_.info(`public ip address: ${this.publicIPAddress_}`);
        }
      }

      const httpProxyRequestObject = http.get(
        this.optionspjExpressApp_,
        (res) => {
          this.logger_.info(
            `checkProxyAnonymity status code: ${res.statusCode}`
          );
          if (res.statusCode !== 200) {
            this.hasErrors_ = true;
            anonymityErrors.push(
              customEnumError("ANONYMITY_CHECK", ErrorsEnum.STATUS_CODE_ERROR)
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
            if (body.length === 0) {
              anonymityErrors.push(
                customEnumError("ANONYMITY_CHECK", ErrorsEnum.PROXY_JUDGE_ERROR)
              );
              this.logger_.error("PROXY JUDGE NO RESPONSE");
              res.destroy();
            }
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
            // if proxy cant/fails to connect to judge, then auto reject
            if (
              anonymityErrors.indexOf(
                `ANONYMITY_CHECK_${ErrorsEnum.STATUS_CODE_ERROR}`
              ) !== -1
            ) {
              reject({
                error: ErrorsEnum.PROXY_JUDGE_ERROR,
              } as ProxyInfoEssential);
            }
            resolve(proxyInfo);
          });
        }
      );

      httpProxyRequestObject.on("error", (error) => {
        this.logger_.error(`ANONYMITY_CHECK socket error: ${error}`);
        anonymityErrors.push(
          customEnumError("ANONYMITY_CHECK", ErrorsEnum.SOCKET_ERROR)
        );
        httpProxyRequestObject.destroy();
      });

      httpProxyRequestObject.on("close", () => {
        if (anonymityErrors.length !== 0) {
          this.hasErrors_ = true;
          proxyInfo.errors = anonymityErrors;
          resolve(proxyInfo);
        }
        this.logger_.info("HTTP Request Object Closed (ANONYMITY_CHECK)");
      });

      httpProxyRequestObject.end();
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
          this.logger_.info(`checkProxyHTTPS statusCode: ${statusCode}`);

          if (statusCode === "200") proxyInfo.https = true;
          else proxyInfo.https = false;
          this.socketEssential_.destroy();
        });
      };

      socketConnect();
    });
  }

  private async checkProxySiteSupport(
    site: string
  ): Promise<ProxyInfoEssential> {
    return new Promise<ProxyInfoEssential>((resolve) => {
      const proxyInfo = {} as ProxyInfoEssential;
      proxyInfo.googleSupport = false;

      const googleErrors: string[] = [];
      const startTime = new Date().getTime();

      const googleOptions = {
        host: this.host_,
        port: Number(this.port_),
        path: site,
        headers: {
          "User-Agent":
            PCheckerEssential.kUserAgents[
              Math.floor(Math.random() * PCheckerEssential.kUserAgents.length)
            ],
        },
      };
      const httpProxyRequestObject = http.get(googleOptions, (res) => {
        if (res.statusCode === 200) {
          proxyInfo.googleSupport = true;
          this.logger_.error(`google check status code: ${res.statusCode}`);
          res.destroy();
        }

        res.on("error", () => {
          googleErrors.push(
            customEnumError(`${site}_CHECK`, ErrorsEnum.SOCKET_ERROR)
          );
          res.destroy();
        });

        res.on("close", () => {
          this.logger_.info(
            `GOOGLE_CHECK RES TIME: ${new Date().getTime() - startTime}`
          );
          if (googleErrors.length !== 0) {
            this.hasErrors_ = true;
            proxyInfo.errors = googleErrors;
          }

          resolve(proxyInfo);
        });
      });

      httpProxyRequestObject.on("error", (error) => {
        this.logger_.error(`GOOGLE_CHECK socket error: ${error}`);
        googleErrors.push(
          customEnumError("GOOGLE_CHECK", ErrorsEnum.SOCKET_ERROR)
        );
        httpProxyRequestObject.destroy();
      });

      httpProxyRequestObject.on("close", () => {
        if (googleErrors.length !== 0) {
          this.hasErrors_ = true;
          proxyInfo.errors = googleErrors;
        }
        this.logger_.info("HTTP Request Object Closed (GOOGLE_CHECK)");

        resolve(proxyInfo);
      });

      httpProxyRequestObject.end();
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

        let body = [] as any[];
        res.on("data", (data) => {
          body.push(data);
        });

        res.on("end", () => {
          try {
            const json = JSON.parse(Buffer.concat(body).toString());
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
            this.logger_.error(`getProxyLocation JSON Parse Error: ${error}`);
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

      httpProxyRequestObject.on("error", (error) => {
        this.logger_.error(`GET_LOCATION socket error: ${error}`);
        locationErrors.push(
          customEnumError("GET_LOCATION", ErrorsEnum.SOCKET_ERROR)
        );
        httpProxyRequestObject.destroy();
      });

      httpProxyRequestObject.on("close", () => {
        if (locationErrors.length !== 0) {
          this.hasErrors_ = true;
        }
        proxyInfo.errors = locationErrors;
        this.logger_.info("HTTP Request Object Closed (GET_LOCATION)");

        resolve(proxyInfo);
      });

      httpProxyRequestObject.end();
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
          this.checkProxySiteSupport("https://google.com/"),
          this.checkProxySiteSupport("https://finance.yahoo.com/"),
          this.getProxyLocation(),
        ];
      } else {
        promises = [
          this.checkProxyAnonymityEssential(),
          this.checkProxyHTTPS(),
          this.checkProxySiteSupport("https://google,com/"),
          this.checkProxySiteSupport("https://finance.yahoo.com/"),
        ];
      }

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
      else delete essentialInfo.errors;

      return essentialInfo;
    } catch (error: any) {
      if (error.hasOwnProperty("judgeError")) {
        this.logger_.error("Proxy Judge Error");
        return {
          error: error["judgeError"],
          proxyString: `${this.host_}:${this.port_}`,
        } as ProxyInfoEssential;
      }

      return {
        unknownError: error,
        proxyString: `${this.host_}:${this.port_}`,
      } as ProxyInfoEssential;
    }
  }
}
