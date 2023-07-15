"use-strict";

import http from "http";
import net from "net";
import { PCheckerBase } from "./PCheckerBase.js";
import {
  ProxyInfoEssential,
  PCheckerOptions,
  PCheckerErrorObject,
} from "./types.js";
import { ProxyAnonymityEnum, ErrorsEnum, PCheckerErrors } from "./emuns.js";

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
    errorEnum: ErrorsEnum,
    res?: http.IncomingMessage
  ) {
    this.hasErrors_ = true;
    proxyInfo.errors.add(errorEnum);
    this.logger_.error(logMessage);
    if (res) res.destroy(new Error(errorEnum));
  }

  /**
   * @method parseHeaders
   * @param body
   * @param proxyInfo
   * @returns void
   * - helper for checkProxyAnonymity to parse proxy headers
   */
  private parseHeaders(body: Buffer[], proxyInfo: ProxyInfoEssential): void {
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

          try {
            const key = line.split("=")[0].trim().toLowerCase().replace("_", "-");
            const value = line.split("=")[1].trim().toLowerCase();
  
            if (this.kFlaggedHeaderValuesSet.has(key)) {
              flaggedHeadersCount++;
              toFlag.push(key);
              if (value === this.publicIPAddress_) {
                myPublicIPAddressCount++;
              }
            }
          } catch (error) {
            proxyInfo.anonymity = undefined;
            this.logger_.info(`checkProxyAnonymity Parse Unknown Error: ${error}`);
            return;
          }
        }
      } else {
        // handle unknown error in "end" event
        proxyInfo.anonymity = undefined;
        this.logger_.info(`checkProxyAnonymity Parse Unknown Error: ${error}`);
        return;
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

  /**
   * @method checkProxyAnonymityEssential
   * @returns Promise<ProxyInfoEssential>
   *  - Parses request headers from proxy, flagged header props in base PChecker class, derives anonymity rating
   *  - more specifically, returns a subset (CheckProxyAnonymity )of props from the ProxyInfoEssential
   *    type associated with proxy anonymity check (see below)
   *  - resolves a ProxyInfoEssential (CheckProxyAnonymity), rejects PCheckerErrorObject
   */
  private checkProxyAnonymityEssential(): Promise<ProxyInfoEssential> {
    return new Promise<ProxyInfoEssential>(async (resolve, reject) => {
      type CheckProxyAnonymity = Pick<
        ProxyInfoEssential,
        "anonymity" | "errors" | "notJSONFlag" | "checkAnonymityTime"
      >;

      const proxyInfo = {} as CheckProxyAnonymity;
      proxyInfo.anonymity = ProxyAnonymityEnum.Unknown;
      proxyInfo.errors = new Set<ErrorsEnum>();
      proxyInfo.notJSONFlag = false; // temp flag, will be deleted

      const startTime = new Date().getTime();

      // checks if public ip address is already pass in, gets IP of client
      if (this.publicIPAddress_ === undefined || this.publicIPAddress_ === "") {
        try {
          const tempPublicIP = await this.getPublicIP();
          this.publicIPAddress_ = String(tempPublicIP);
          this.logger_.info(`public ip address: ${this.publicIPAddress_}`);
        } catch (error) {
          reject({
            [PCheckerErrors.checkAnonymityError]:
              ErrorsEnum.PUBLIC_IP_ADDRESS_ERROR,
          });
          return;
        }
      }

      const req = http.get(this.optionsProxyJudge_, (res) => {
        const { statusCode } = res;
        this.logger_.info(`checkProxyAnonymity status code: ${res.statusCode}`);
        let contentType = res.headers["content-type"];

        if (statusCode !== 200) {
          this.handleErrors(
            proxyInfo,
            `checkProxyAnonymity: Bad Status Code`,
            ErrorsEnum.STATUS_CODE_ERROR,
            res
          );
        } else if (
          !/^application\/json/.test(String(contentType)?.split(";")[0])
        ) {
          this.logger_.warn(`checkProxyAnonymity content type is not JSON`);
          proxyInfo.notJSONFlag = true;
        }

        // push data into buffer
        const body = [] as Buffer[];
        res.on("data", (chunk: Buffer) => body.push(chunk));

        // done buffering response
        res.on("end", () => {
          this.logger_.info(
            `checkProxyAnonymity network response: ${
              new Date().getTime() - startTime
            }`
          );

          // empty response, something went wrong
          if (body.length === 0) {
            this.handleErrors(
              proxyInfo,
              `checkProxyAnonymity: Empty Response`,
              ErrorsEnum.EMPTY_RESPONSE,
              res
            );
            return;
          }

          // parseHeaders will modify anonymity rating and anonymityErrors
          this.parseHeaders(body, proxyInfo);
          delete proxyInfo.notJSONFlag;

          // parse error, handle in "close" event
          if (!proxyInfo.anonymity || proxyInfo.errors.size > 0) {
            this.handleErrors(
              proxyInfo,
              `checkProxyAnonymity: Bad Parse`,
              ErrorsEnum.PARSE_ERROR,
              res
            );
          } else {
            // close socket, check for unhandle errors, go to success case
            res.destroy();
          }
        });

        res.on("error", (error) => {
          const inErrorsEnum: boolean = error.message in ErrorsEnum;
          if (inErrorsEnum) {
            reject({
              [PCheckerErrors.checkAnonymityError]: error.message,
            } as PCheckerErrorObject);
          } else {
            reject({
              [PCheckerErrors.checkAnonymityError]: ErrorsEnum.SOCKET_ERROR,
            } as PCheckerErrorObject);
          }
        });

        res.on("close", () => {
          proxyInfo.checkAnonymityTime = new Date().getTime() - startTime;

          // further error handling here, handle any error we didnt catch
          if (
            proxyInfo.errors.size > 0 &&
            !this.hasErrors_ &&
            proxyInfo.errors
          ) {
            this.hasErrors_ = true;
            reject({
              [PCheckerErrors.checkAnonymityError]: ErrorsEnum.SOCKET_ERROR,
            } as PCheckerErrorObject);
          } else {
            // success case
            resolve(proxyInfo);
          }
        });
      });

      req.setTimeout(this.timeout_, () => {
        req.destroy(new Error(ErrorsEnum.TIMEOUT));
      });

      req.on("error", (error) => {
        if (error.message === ErrorsEnum.TIMEOUT) {
          reject({
            [PCheckerErrors.checkAnonymityError]: ErrorsEnum.TIMEOUT,
          } as PCheckerErrorObject);
        } else {
          reject({
            [PCheckerErrors.checkAnonymityError]:
              ErrorsEnum.SOCKET_REQUEST_ERROR,
          } as PCheckerErrorObject);
        }
      });

      // handle socket error here
      req.on("close", () => {
        this.logger_.info("HTTP Request Socket Closed (ANONYMITY_CHECK)");
      });

      req.end();
    });
  }

  /**
   * @method checkProxyHTTPS
   * @returns Promise<ProxyInfoEssential>
   *  - creates new socket to send HTTP connect request to proxy, determines if proxy supports HTTPS (tunnel) based on status code
   *    if no response is receieve, will assume that proxy does not support HTTPS
   *  - returns subset of type ProxyInfoEssential (CheckProxyHTTPS)
   */
  private async checkProxyHTTPS(): Promise<ProxyInfoEssential> {
    return new Promise<ProxyInfoEssential>((resolve, reject) => {
      type CheckProxyHTTPS = Pick<
        ProxyInfoEssential,
        "https" | "httpConnectRes" | "errors"
      >;

      const proxyInfo = {} as CheckProxyHTTPS;
      proxyInfo.httpConnectRes = -1;
      proxyInfo.errors = new Set<ErrorsEnum>();

      let response: string;
      let statusCode: string;

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

          // ensure socket is closed
          this.socketEssential_.destroy();
        });

        this.socketEssential_.setTimeout(this.timeout_, () => {
          this.socketEssential_.destroy(new Error(ErrorsEnum.TIMEOUT));
        });

        // todo: better/more specifc error handling
        this.socketEssential_.on("error", (error) => {
          if (error.message === ErrorsEnum.TIMEOUT) {
            reject({
              [PCheckerErrors.checkHTTPSError]: ErrorsEnum.TIMEOUT,
            } as PCheckerErrorObject);
          } else {
            reject({
              [PCheckerErrors.checkHTTPSError]: ErrorsEnum.SOCKET_ERROR,
            } as PCheckerErrorObject);
          }
        });

        // resolve when socket is close, we destory after seeing sucessful status code
        this.socketEssential_.on("close", () => {
          proxyInfo.httpConnectRes = new Date().getTime() - startTime;
          // further error handling here, handle any error we didnt handle
          if (
            proxyInfo.errors.size > 0 &&
            !this.hasErrors_ &&
            proxyInfo.errors
          ) {
            this.hasErrors_ = true;
            reject({
              [PCheckerErrors.checkHTTPSError]: ErrorsEnum.SOCKET_ERROR,
            } as PCheckerErrorObject);
          }

          this.logger_.info(`HTTPS Socket Closed`);
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
            resolve(proxyInfo);
            this.socketEssential_.destroy();
          } else {
            proxyInfo.https = false;
            resolve(proxyInfo);
            this.socketEssential_.destroy();
          }
        });
      };

      socketConnect();
    });
  }

  /**
   * @method checkProxySiteSupport
   * @param site, url of site to check thru proxy
   * @returns Promise<ProxyInfoEssential>
   *  - tries HTTP get request to passed in site url through proxy, returns status code
   */
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

      let isOk: boolean = undefined;
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

      const req = http.get(reqOptions, (res) => {
        this.logger_.info(`${site} check status code: ${res.statusCode}`);
        if (res.statusCode === 200) {
          isOk = true;
        } else {
          isOk = false;
        }
        res.resume();
        res.destroy();

        res.on("error", (error) => {
          this.logger_.error(`check_${site} error: ${error}`);
          isOk = false;
        });

        res.on("close", () => {
          this.logger_.info(
            `${site} Response Time: ${new Date().getTime() - startTime}`
          );
        });
      });

      req.setTimeout(this.timeout_, () => {
        req.destroy(new Error(ErrorsEnum.TIMEOUT));
      });

      req.on("error", (error) => {
        isOk = false;
        if (error.message === ErrorsEnum.TIMEOUT) {
          this.logger_.error(`checkSite timeout`);
        } else {
          this.logger_.error(`checkSite error: ${error}`);
        }
      });

      req.on("close", () => {
        const newProp = `${extractDomains(site).join("")}${extractRoutes(
          site
        ).join("")}_support`;
        proxyInfo[newProp] = isOk;
        resolve(proxyInfo);
        this.logger_.info(`HTTP Request Socket Closed (${site})`);
      });

      req.end();
    });
  }

  /**
   * @method getProxyLocation
   * @returns ProxyInfoEssential (ProxyLocation)
   * Gets country code of proxy, depends on ip-api.com
   */
  private async getProxyLocation(): Promise<ProxyInfoEssential> {
    type ProxyLocation = Pick<ProxyInfoEssential, "countryCode" | "errors">;

    return new Promise<ProxyInfoEssential>((resolve, reject) => {
      const proxyInfo = {} as ProxyLocation;
      proxyInfo.countryCode = "";
      proxyInfo.errors = new Set<ErrorsEnum>();

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

      const req = http.get(requestOptions, (res) => {
        if (res.statusCode !== 200) {
          this.handleErrors(
            proxyInfo,
            `getProxyLocatio: Bad Status Code: ${res.statusCode}`,
            ErrorsEnum.STATUS_CODE_ERROR,
            res
          );
        }

        const body = [] as Buffer[];
        res.on("data", (data) => body.push(data));

        res.on("end", () => {
          try {
            const json = JSON.parse(Buffer.concat(body).toString());
            if (json.hasOwnProperty("countryCode")) {
              proxyInfo.countryCode = json.countryCode;
            } else {
              this.handleErrors(
                proxyInfo,
                `getProxyLocatio: Bad Response Error`,
                ErrorsEnum.BAD_RESPONSE,
                res
              );
            }
          } catch (error) {
            this.logger_.error(`getProxyLocation JSON Parse Error: ${error}`);
            this.handleErrors(
              proxyInfo,
              `getProxyLocation: JSON Parse Error`,
              ErrorsEnum.JSON_PARSE_ERROR,
              res
            );
          }
        });

        res.on("error", (error) => {
          const inErrorsEnum = error.message in ErrorsEnum;
          if (inErrorsEnum) {
            reject({
              [PCheckerErrors.getProxyLocationError]: error.message,
            } as PCheckerErrorObject);
          } else {
            reject({
              [PCheckerErrors.getProxyLocationError]: ErrorsEnum.SOCKET_ERROR,
            } as PCheckerErrorObject);
          }
        });

        res.on("close", () => {
          this.logger_.info(
            `getProxyLocation response time: ${
              new Date().getTime() - startTime
            } ms`
          );

          if (
            proxyInfo.errors.size > 0 &&
            !this.hasErrors_ &&
            proxyInfo.errors
          ) {
            this.hasErrors_ = true;
            reject({
              [PCheckerErrors.getProxyLocationError]: ErrorsEnum.SOCKET_ERROR,
            } as PCheckerErrorObject);
          } else {
            // success case
            resolve(proxyInfo);
          }
        });
      });

      req.setTimeout(this.timeout_, () => {
        req.destroy(new Error(ErrorsEnum.TIMEOUT));
      });

      req.on("error", (error) => {
        if (error.message === ErrorsEnum.TIMEOUT) {
          reject({
            [PCheckerErrors.getProxyLocationError]: ErrorsEnum.TIMEOUT,
          } as PCheckerErrorObject);
        } else {
          reject({
            [PCheckerErrors.getProxyLocationError]: ErrorsEnum.SOCKET_ERROR,
          } as PCheckerErrorObject);
        }
      });

      req.on("close", () => {
        this.logger_.info("HTTP Request Object Closed (GET_LOCATION)");
      });

      req.end();
    });
  }

  /*
   * @method checkProxyEssential
   * @returns: Promise<Object | Error>
   * Check essential proxy info
   */
  public async checkProxyEssential(): Promise<ProxyInfoEssential> {
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

      const results = (await Promise.all(promises)) as ProxyInfoEssential[];
      const validResults = results.filter(
        (result) => !(result instanceof Error)
      );
      const essentialInfo: ProxyInfoEssential = Object.assign(
        {},
        ...validResults
      );
      essentialInfo.proxyString = `${this.host_}:${this.port_}`;
      if (!this.hasErrors_) delete essentialInfo.errors;

      return essentialInfo;

    } catch (error: any) {
      if (error.hasOwnProperty(PCheckerErrors.checkAnonymityError)) {
        this.logger_.error(
          `check anonymity ${String(error[PCheckerErrors.checkAnonymityError])}`
        );
        return {
          error: error[PCheckerErrors.checkAnonymityError],
          proxyString: `${this.host_}:${this.port_}`,
        } as ProxyInfoEssential;
      }

      if (error.hasOwnProperty(PCheckerErrors.checkHTTPSError)) {
        this.logger_.error(
          `check HTTPS ${String(error[PCheckerErrors.checkHTTPSError])}`
        );
        return {
          error: error[PCheckerErrors.checkHTTPSError],
          proxyString: `${this.host_}:${this.port_}`,
        } as ProxyInfoEssential;
      }

      if (error.hasOwnProperty(PCheckerErrors.getProxyLocationError)) {
        this.logger_.error(
          `check location ${String(
            error[PCheckerErrors.getProxyLocationError]
          )}`
        );
        return {
          error: error[PCheckerErrors.getProxyLocationError],
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
