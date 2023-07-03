"use-strict";

import http from "http";
import net from "net";
import { PCheckerBase } from "./PCheckerBase.js";
import { ProxyInfoEssential, PCheckerOptions } from "./types.js";
import {
  ProxyAnonymityEnum,
  ErrorsEnum,
  PCheckerErrors,
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

  private handleErrors(
    proxyInfo: ProxyInfoEssential,
    logMessage: string,
    errorType: PCheckerErrors,
    errorEnum: ErrorsEnum
  ) {
    this.hasErrors_ = true;
    proxyInfo.errors.push(customEnumError(errorType, errorEnum));
    this.logger_.error(logMessage);
  }

  // seperate to test
  private parseHeaders(body: any[], proxyInfo: ProxyInfoEssential): void {
    let headers: JSON | string[];
    let myPublicIPAddressCount = 0;
    let flaggedHeadersCount = 0;
    const toFlag: any[] = [];

    try {
      // no need to try JSON parse if content is not JSON
      if (proxyInfo.notJSONFlag) throw new SyntaxError();

      headers = JSON.parse(Buffer.concat(body).toString()) as JSON;
      this.logger_.info(`pj res: ${JSON.stringify(headers)}`);

      for (const key of Object.keys(headers)) {
        if (this.kFlaggedHeaderValuesSet.has(key)) {
          flaggedHeadersCount++;
          toFlag.push(key);
          if (String(headers[key as keyof JSON]) === this.publicIPAddress_) {
            myPublicIPAddressCount++;
          }
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.logger_.warn("checkProxyAnonymity response is not JSON");

        // proxy judge still sends a valid response but not in json
        // mostly will be each header properties on a new line
        headers = Buffer.concat(body).toString().split("\n");
        this.logger_.info(headers);

        // most likely shape of line: "header prop = prop value"
        for (const line of headers) {
          if (!line) continue;
          const key = line.split("=")[0].trim().toLowerCase().replace("_", "-");
          const value = line.split("=")[1].trim().toLowerCase();

          if (this.kFlaggedHeaderValuesSet.has(key)) {
            flaggedHeadersCount++;
            toFlag.push(key);
            if (value === this.publicIPAddress_) {
              myPublicIPAddressCount++;
            }
          }
        }
      } else {
        proxyInfo.anonymity = undefined;
        this.handleErrors(
          proxyInfo,
          `checkProxyAnonymity final parse error: ${error}`,
          PCheckerErrors.checkAnonymityError,
          ErrorsEnum.PROXY_JUDGE_ERROR
        );
      }
    }

    // check if flagged header properties exist
    proxyInfo.anonymity =
      flaggedHeadersCount === 0
        ? ProxyAnonymityEnum.Elite
        : ProxyAnonymityEnum.Anonymous;

    if (flaggedHeadersCount > 0) {
      // check if public ip is shown
      proxyInfo.anonymity =
        myPublicIPAddressCount === 0
          ? ProxyAnonymityEnum.Anonymous
          : ProxyAnonymityEnum.Transparent;
      this.logger_.info(`flagged header properties: ${toFlag}`);
    }
  }

  private async checkProxyAnonymityEssential(): Promise<ProxyInfoEssential> {
    return new Promise<ProxyInfoEssential>(async (resolve, reject) => {
      const proxyInfo = {} as ProxyInfoEssential;
      proxyInfo.anonymity = ProxyAnonymityEnum.Unknown;
      proxyInfo.errors = [] as string[];
      proxyInfo.notJSONFlag = false;

      const startTime = new Date().getTime();

      // checks if public ip address is already pass in, gets IP of client
      if (this.publicIPAddress_ === undefined || this.publicIPAddress_ === "") {
        const tempPublicIP = await this.getPublicIP();

        if (tempPublicIP.hasOwnProperty("error")) {
          this.logger_.error(`checkProxyAnonymityEssential getPublicIP error`);
          reject({
            [PCheckerErrors.checkAnonymityError]:
              ErrorsEnum.PUBLIC_IP_ADDRESS_ERROR,
          });
          return;
        } else {
          this.publicIPAddress_ = String(tempPublicIP);
          this.logger_.info(`public ip address: ${this.publicIPAddress_}`);
        }
      }

      const httpProxyRequestObject = http.get(
        this.optionspjExpressApp_,
        (res) => {
          const { statusCode } = res;
          this.logger_.info(
            `checkProxyAnonymity status code: ${res.statusCode}`
          );
          let contentType = res.headers["content-type"];

          if (statusCode !== 200) {
            this.handleErrors(
              proxyInfo,
              `checkProxyAnonymity: Bad Status Code`,
              PCheckerErrors.checkAnonymityError,
              ErrorsEnum.STATUS_CODE_ERROR
            );

            res.resume();
            reject({
              [PCheckerErrors.checkAnonymityError]:
                ErrorsEnum.STATUS_CODE_ERROR,
            });
            return;
          } else if (!/^application\/json/.test(contentType!.split(";")[0])) {
            this.logger_.warn(`checkProxyAnonymity content type is not JSON`);
            proxyInfo.notJSONFlag = true;
          }

          // push data into buffer
          const body = [] as Buffer[];
          res.on("data", (chunk: Buffer) => body.push(chunk));

          // done buffering response
          res.on("end", () => {
            this.logger_.info(
              `checkProxyAnonymity proxy judge (network) response: ${
                new Date().getTime() - startTime
              }`
            );

            // empty response, something went wrong
            if (body.length === 0) {
              this.handleErrors(
                proxyInfo,
                `checkProxyAnonymity: Bad Status Code`,
                PCheckerErrors.checkAnonymityError,
                ErrorsEnum.EMPTY_RESPONSE
              );

              // at this point, already have read all data, free up all resources
              res.destroy();
              reject({
                [PCheckerErrors.checkAnonymityError]: ErrorsEnum.EMPTY_RESPONSE,
              });
              return;
            }

            // parseHeaders will modify anonymity rating and anonymityErrors
            this.parseHeaders(body, proxyInfo);

            // parse error, handle in "close" event
            if (!proxyInfo.anonymity || proxyInfo.errors.length > 0) {
              res.destroy();
              reject({
                [PCheckerErrors.checkAnonymityError]: ErrorsEnum.PARSE_ERROR,
              });
              return;
            } else {
              res.destroy();
              resolve(proxyInfo);
              return;
            }
          });

          res.on("close", () => {
            proxyInfo.checkAnonymityTime = new Date().getTime() - startTime;

            // further error handling here, handle any error we didnt handle
            if (
              proxyInfo.errors.length > 0 &&
              !this.hasErrors_ &&
              proxyInfo.errors
            ) {
              this.hasErrors_ = true;
              reject({
                [PCheckerErrors.checkAnonymityError]: ErrorsEnum.SOCKET_ERROR,
              });
              return;
            }
          });

          res.on("error", () => {
            this.handleErrors(
              proxyInfo,
              `checkProxyAnonymity: Socket Error`,
              PCheckerErrors.checkAnonymityError,
              ErrorsEnum.SOCKET_ERROR
            );

            reject({
              [PCheckerErrors.checkAnonymityError]: ErrorsEnum.SOCKET_ERROR,
            });
            return;
          });
        }
      );

      httpProxyRequestObject.on("error", (error) => {
        this.handleErrors(
          proxyInfo,
          `ANONYMITY_CHECK socket error: ${error}`,
          PCheckerErrors.checkAnonymityError,
          ErrorsEnum.SOCKET_HANG_UP
        );

        reject({
          [PCheckerErrors.checkAnonymityError]: ErrorsEnum.SOCKET_ERROR,
        });
        return;
      });

      // handle socket error here
      httpProxyRequestObject.on("close", () => {
        // further error handling here, handle any error we didnt handle
        if (proxyInfo.errors.length > 0 && !this.hasErrors_) {
          this.hasErrors_ = true;

          reject({
            [PCheckerErrors.checkAnonymityError]: ErrorsEnum.SOCKET_HANG_UP,
          });
          return;
        }
        this.logger_.info("HTTP Request Object Closed (ANONYMITY_CHECK)");
      });

      httpProxyRequestObject.end();
    });
  }

  private async checkProxyHTTPS(): Promise<ProxyInfoEssential> {
    return new Promise<ProxyInfoEssential>((resolve, reject) => {
      const proxyInfo = {} as ProxyInfoEssential;
      proxyInfo.httpConnectRes = -1;
      proxyInfo.errors = [] as string[];

      let response: string;
      let statusCode: string;
      let didConnect: boolean = false;

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

        this.socketEssential_.on("end", () => {
          this.logger_.info(
            `https response time (network): ${new Date().getTime() - startTime}`
          );

          // handles empty response
          if (
            proxyInfo.https === undefined ||
            response === undefined ||
            statusCode === undefined
          ) {
            proxyInfo.https = false;
          }

          resolve(proxyInfo);
          return;
        });

        // resolve when socket is close, we destory after seeing sucessful status code
        this.socketEssential_.on("close", () => {
          // further error handling here, handle any error we didnt handle
          if (
            proxyInfo.errors.length > 0 &&
            !this.hasErrors_ &&
            proxyInfo.errors
          ) {
            this.hasErrors_ = true;
            reject({
              [PCheckerErrors.checkHTTPSError]: ErrorsEnum.SOCKET_ERROR,
            });
            return;
          }
        });

        // todo: better/more specifc error handling
        this.socketEssential_.on("error", (error) => {
          this.handleErrors(
            proxyInfo,
            `ANONYMITY_CHECK socket error: ${error}`,
            PCheckerErrors.checkHTTPSError,
            ErrorsEnum.SOCKET_ERROR
          );

          reject({
            [PCheckerErrors.checkHTTPSError]: ErrorsEnum.SOCKET_ERROR,
          });
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
          if (endOfHeaders === -1) return;

          // parse actual response, usually something like: "HTTP/1.1 200 Connection established"
          response = buffered.toString("ascii", 0, buffered.indexOf("\r\n"));

          // parse status code from response
          statusCode = String(+response.split(" ")[1]);
          this.logger_.info(`checkProxyHTTPS statusCode: ${statusCode}`);

          if (statusCode === "200") {
            proxyInfo.https = true;
            this.socketEssential_.destroy();
            resolve(proxyInfo);
            return;
          } else {
            proxyInfo.https = false;
            this.socketEssential_.destroy();
            resolve(proxyInfo);
            return;
          }

          // empty responses will be handled in the on "end" event
        });
      };

      socketConnect();
    });
  }

  private async checkProxySiteSupport(
    site: string
  ): Promise<ProxyInfoEssential> {
    // chatgpt4 wrote this, idk regex
    function isValidUrl(url: string): boolean {
      let pattern = new RegExp(
        "^(https?:\\/\\/)?" + // protocol
          "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name and extension
          "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
          "(\\:\\d+)?" + // port
          "(\\/[-a-z\\d%_.~+]*)*" + // path
          "(\\?[;&amp;a-z\\d%_.~+=-]*)?" + // query string
          "(\\#[-a-z\\d_]*)?$",
        "i"
      ); // fragment locator
      return !!pattern.test(url);
    }

    function extractDomains(url: string): string[] {
      let domain: string;
      if (url.indexOf("://") > -1) domain = url.split("/")[2];
      else domain = url.split("/")[0];

      domain = domain.split(":")[0];
      domain = domain.split("?")[0];

      let domains: string[] = domain.split(".");
      domains = domains.filter((e) => e !== "www" && e !== "com");
      return domains;
    }

    function extractRoutes(url: string): string[] {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.startsWith("/")
        ? urlObj.pathname.slice(1)
        : urlObj.pathname;
      return pathname.split("/").filter((segment) => segment !== "");
    }

    if (!isValidUrl(site)) {
      this.logger_.error(`${site} is not a valid url`);
      throw { [PCheckerErrors.siteCheckError]: ErrorsEnum.BAD_URL_FORMAT };
    }

    return new Promise<ProxyInfoEssential>((resolve, reject) => {
      const proxyInfo = {} as ProxyInfoEssential;
      proxyInfo.errors = [] as string[];

      let sucessResponse: boolean = undefined;
      const startTime = new Date().getTime();

      const reqOptions = {
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

      const httpProxyRequestObject = http.get(reqOptions, (res) => {
        this.logger_.info(`${site} check status code: ${res.statusCode}`);
        if (res.statusCode === 200) {
          sucessResponse = true;
        } else {
          sucessResponse = false;
        }
        res.destroy();

        res.on("close", () => {
          this.logger_.info(
            `${site} RES TIME: ${new Date().getTime() - startTime}`
          );

          const newProp = `${extractDomains(site).join("")}${extractRoutes(
            site
          ).join("")}_support`;
          resolve(proxyInfo);
        });

        res.on("error", (error) => {
          this.handleErrors(
            proxyInfo,
            `ANONYMITY_CHECK socket error: ${error}`,
            PCheckerErrors.siteCheckError,
            ErrorsEnum.SOCKET_ERROR
          );

          reject({
            [PCheckerErrors.siteCheckError]: ErrorsEnum.SOCKET_ERROR,
          });
        });
      });

      httpProxyRequestObject.on("error", (error) => {
        this.handleErrors(
          proxyInfo,
          `ANONYMITY_CHECK socket error: ${error}`,
          PCheckerErrors.siteCheckError,
          ErrorsEnum.SOCKET_ERROR
        );

        reject({
          [PCheckerErrors.siteCheckError]: ErrorsEnum.SOCKET_ERROR,
        });
      });

      httpProxyRequestObject.on("close", () => {
        this.logger_.info(`HTTP Request Object Closed ${site}`);
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
      let promises: Promise<ProxyInfoEssential>[] = [];
      if (this.sitesToCheck_)
        this.sitesToCheck_.forEach((site) =>
          promises.push(this.checkProxySiteSupport(site))
        );

      // run location as default, also runs everything
      if (this.runProxyLocation_) {
        promises.push(this.checkProxyAnonymityEssential());
        promises.push(this.checkProxyHTTPS());
        promises.push(this.getProxyLocation());
      } else {
        promises.push(this.checkProxyAnonymityEssential());
        promises.push(this.checkProxyHTTPS());
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
        ...validResults
      );
      essentialInfo.proxyString = `${this.host_}:${this.port_}`;
      if (allErrors.length !== 0) essentialInfo.errors = allErrors;
      else delete essentialInfo.errors;

      return essentialInfo;
    } catch (error: any) {
      console.log(error);
      if (error.hasOwnProperty(PCheckerErrors.checkAnonymityError)) {
        this.logger_.error("Error with Anonymity Check");
        return {
          error: error[PCheckerErrors.checkAnonymityError],
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
