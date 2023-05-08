"use-strict";

import http from "http";
import net from "net";
import { PCheckerBase } from "./PCheckerBase.js";
import { ProxyError, ProxyInfoEssential } from "./types.js";
import {
  ENUM_FlaggedHeaderValues,
  ENUM_ProxyAnonymity,
  ENUM_ERRORS,
} from "./emuns.js";

import { createLogger, transports, format } from "winston";

const logger = createLogger({
  transports: [new transports.Console()],
  format: format.combine(
    format.colorize(),
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
});

export class PCheckerEssential extends PCheckerBase {
  private socketEssential_: net.Socket;

  constructor(
    host?: string,
    port?: string,
    timeout?: string,
    publicIPAddress?: string | Promise<string | ProxyError>,
    username?: string,
    password?: string
  ) {
    super(host, port, timeout, publicIPAddress, username, password);
  }

  private async checkProxyAnonymityEssential(): Promise<
    ProxyInfoEssential | ProxyError
  > {
    return new Promise<ProxyInfoEssential | ProxyError>((resolve) => {
      const proxyInfo = {} as ProxyInfoEssential;
      let errorObject = {} as ProxyError;
      let startTime = new Date().getTime();

      http.get(this.optionspj_, (res) => {
        if (res.statusCode !== 200) {
          errorObject.error = ENUM_ERRORS.StatusCodeError;
          logger.error(`checkProxyAnonymity status code: ${res.statusCode}`);

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
                    String(this.publicIPAddress_)
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
            errorObject.error = ENUM_ERRORS.JSONParseError;
            logger.error(`checkProxyAnonymity JSON parse error: ${error}`);
          }

          res.destroy();
        });

        res.on("error", (error) => {
          errorObject.error = ENUM_ERRORS.SocketError;
          logger.error(`checkProxyAnonymity socket error: ${error}`);

          res.destroy();
        });

        res.on("close", () => {
          proxyInfo.responseTime = new Date().getTime() - startTime;
          if (Object.keys(errorObject).length !== 0) resolve(errorObject);
          else resolve(proxyInfo);
        });
      });
    });
  }

  private async checkProxyHTTPS(): Promise<ProxyInfoEssential | ProxyError> {
    return new Promise<ProxyInfoEssential | ProxyError>((resolve) => {
      let proxyInfo = {} as ProxyInfoEssential;
      let errorObject = {} as ProxyError;
      let startTime = new Date().getTime();
      let buffersLength: number = 0;
      const buffers = [] as Buffer[];

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
        });

        // dont need to buffer any traffic before proxy connect
        // onData will reject all non-200 res from server =>
        // meaning/confirming server has no https support
        onData();

        // check response at socket end
        this.socketEssential_.on("end", () => {
          // handle empty response here
          logger.info(`checkProxyHTTPS empty response: https not supported`);
          if (proxyInfo.https === undefined || !proxyInfo.https) {
            proxyInfo.https = false;
          }
        });

        // resolve when socket is close, we destory after seeing sucessful status code
        this.socketEssential_.on("close", () => {
          proxyInfo.connectResponseTime = new Date().getTime() - startTime;
          if (Object.keys(errorObject).length !== 0) resolve(errorObject);
          else resolve(proxyInfo);
        });

        // todo: better/more specifc error handling
        this.socketEssential_.on("error", (error) => {
          errorObject.error = ENUM_ERRORS.SocketError;
          logger.error(`getProxyLocation connect error: ${error}`);

          this.socketEssential_.destroy();
        });
      };

      // shamelessly taken from https://github.com/TooTallNate/node-https-proxy-agent/blob/master/src/parse-proxy-response.ts
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
          const response = buffered.toString(
            "ascii",
            0,
            buffered.indexOf("\r\n")
          );

          // parse status code from response
          const statusCode = String(+response.split(" ")[1]);

          // 403 status code may hint at https support with auth
          // 500 status code may hint at https support
          logger.info(`checkProxyHTTPS statusCode: ${statusCode}`);
          if (statusCode === "403" || statusCode === "401")
            logger.warn(`auth may be required`);
          else if (statusCode[0] === "4") logger.warn(`not support generally`);
          else if (statusCode[0] === "5")
            logger.warn(`proxy server error, probably no https support`);

          // check if digit of status code from CONNECT request
          if (statusCode[0] === "2") proxyInfo.https = true;
          else proxyInfo.https = false;

          this.socketEssential_.destroy();
        });
      };

      socketConnect();
    });
  }

  private async getProxyLocation(): Promise<ProxyInfoEssential | ProxyError> {
    return new Promise<ProxyInfoEssential | ProxyError>((resolve) => {
      let proxyInfo = {} as ProxyInfoEssential;
      let errorObject = {} as ProxyError;
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

      http.get(requestOptions, (res) => {
        if (res.statusCode !== 200) {
          errorObject.error = ENUM_ERRORS.StatusCodeError;
          logger.error(`getProxyLocation bad status code: ${res.statusCode}`);
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
              errorObject.error = ENUM_ERRORS.GeoLocationError;
              logger.error(`getProxyLocation doesnt have county code`);
              res.destroy();
            }
          } catch (error) {
            errorObject.error = ENUM_ERRORS.JSONParseError;
            logger.error(`getProxyLocation JSON Parse Error`);
            res.destroy();
          }
        });

        res.on("error", (error) => {
          errorObject.error = ENUM_ERRORS.SocketError;
          logger.error(`getProxyLocation connect error: ${error}`);
          res.destroy();
        });
        
        res.on("close", () => {
          const endtime = new Date().getTime() - startTime;
          logger.info(`getProxyLocation response time: ${endtime} ms`);
          
          if (Object.keys(errorObject).length !== 0) resolve(errorObject);
          else resolve(proxyInfo);
        });
      });
    });
  }

  /**
   * @method: checkProxyEssential(),
   * @returns: Promise<Object | Error>
   * Check essential proxy info
   */
  protected async checkProxyEssential() /* : Promise<ProxyInfoEssential | ProxyError> */ {
    const timeoutPromise: Promise<ProxyError> = this.createTimeout("timedout");

    // race between timeout and promises
    try {
      const promises: Promise<ProxyInfoEssential | ProxyError>[] = [
        this.checkProxyAnonymityEssential(),
        this.checkProxyHTTPS(),
        this.getProxyLocation(),
      ];
      let race = await Promise.race([timeoutPromise, Promise.all(promises)]);
      if (race.hasOwnProperty("timeoutdata")) return race as ProxyError;

      const results = race as ProxyInfoEssential[];
      const validResults = results.filter(
        (result) => !(result instanceof Error)
      );
      const essentialInfo: ProxyInfoEssential = Object.assign(
        {},
        validResults[0],
        validResults[1],
        validResults[2]
      );

      return essentialInfo;
    } catch (error) {
      logger.error(`checkProxyEssential error: ${error}`);
      return { error: ENUM_ERRORS.PromiseRaceError } as ProxyError;
    }
  }
}
