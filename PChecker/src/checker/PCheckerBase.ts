"use-strict";

import http from "http";
import { ProxyOptions, PCheckerErrorObject, PCheckerOptions } from "./types.js";
import { ErrorsEnum, PCheckerErrors } from "./emuns.js";
import { createLogger, transports, format, Logger } from "winston";

/**
 * @todo:
 *  - add default options
 */
export class PCheckerBase {
  protected host_: string;
  protected port_: string;
  protected timeout_: number;
  protected optionspj_: ProxyOptions;
  protected optionspjExpressApp_: any;
  protected agent_: http.Agent;
  protected publicIPAddress_: string;
  protected runProxyLocation_: boolean;
  protected sitesToCheck_: string[];
  protected username_: string;
  protected password_: string;
  protected auth_: string;
  protected timeoutsArray_: Array<Promise<any>>;
  protected logger_: Logger;

  protected static readonly kProxyJudgeURL: string = `http://myproxyjudgeclee.software/pj-cleeclee123.php`;
  protected static readonly kProxyJudgeExpressHost: string = "198.58.101.166";
  protected static readonly kProxyJudgeURLExpressApp: string = `http://198.58.101.166:6969/azenv`;
  protected static readonly kUserAgents: string[] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0",
    "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36",
  ];
  protected readonly kFlaggedHeaderValuesSet: Set<string> = new Set([
    "authentication",
    "client-ip",
    "x-client-ip",
    "from",
    "forwarded-for",
    "forwarded",
    "proxy-authorization",
    "proxy-connection",
    "remote-addr",
    "remote-port",
    "via",
    "forwarded",
    "forwarded-for",
    "x-cluster-client-ip",
    "x-forwarded-for",
    "x-forwarded-for-ip",
    "x-forwarded-proto",
    "x-forwarded",
    "x-forwarded-host",
    "x-proxy-id",
    "x-frame-options",
    "x-content-type-option",
    "x-dns-prefetch-control-control",
    "x-xss-protection",
    "x-real-ip",
    "set-cookies",
  ]);

  constructor(pcheckerOptions?: PCheckerOptions) {
    // always constructed
    this.optionspj_ = {} as ProxyOptions;
    this.agent_ = {} as http.Agent;
    this.timeoutsArray_ = [] as Array<Promise<any>>;

    if (pcheckerOptions !== undefined) {
      this.host_ = pcheckerOptions.host;
      this.port_ = pcheckerOptions.port;
      this.timeout_ = Number(pcheckerOptions.timeout);
      this.publicIPAddress_ = pcheckerOptions.publicIPAddress;
      this.username_ = pcheckerOptions.username;
      this.password_ = pcheckerOptions.password;
      this.runProxyLocation_ = pcheckerOptions.runProxyLocation;
      this.sitesToCheck_ = pcheckerOptions.sitesToCheck;

      (pcheckerOptions.username !== undefined &&
        pcheckerOptions.password !== undefined) ||
      (pcheckerOptions.username !== "" && pcheckerOptions.password !== "")
        ? (this.auth_ =
            "Basic " +
            Buffer.from(
              pcheckerOptions.username + ":" + pcheckerOptions.username
            ).toString("base64"))
        : (this.auth_ = undefined);
      if (this.auth_ !== undefined) {
        this.optionspj_.headers = { "Proxy-Authorization": this.auth_ };
      }
    }

    this.optionspj_ = {
      host: this.host_,
      port: Number(this.port_),
      method: "GET",
      path: PCheckerBase.kProxyJudgeURL,
      headers: {
        Connection: "Keep-Alive",
        "User-Agent":
          PCheckerBase.kUserAgents[
            Math.floor(Math.random() * PCheckerBase.kUserAgents.length)
          ],
      },
      agent: (this.agent_ = new http.Agent({
        keepAlive: true,
        maxSockets: 1,
        keepAliveMsecs: 1000,
      })),
    };

    this.optionspjExpressApp_ = {
      host: this.host_,
      port: Number(this.port_),
      method: "GET",
      path: PCheckerBase.kProxyJudgeURLExpressApp,
      headers: {
        Host: PCheckerBase.kProxyJudgeExpressHost,
        "User-Agent":
          PCheckerBase.kUserAgents[
            Math.floor(Math.random() * PCheckerBase.kUserAgents.length)
          ],
      },
    };

    this.logger_ = createLogger({
      transports: [new transports.Console()],
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    });
  }

  /**
   * @method: getPublicIP(), private helper function
   * @returns Promise<String | Error>
   * Gets Your Public IP Address
   */
  
  protected getPublicIP(): Promise<string | PCheckerErrorObject> {
    return new Promise<string>((resolve, reject) => {
      const startTime = new Date().getTime();
      let promiseFlag: boolean = false;

      const requestOptions = {
        host: PCheckerBase.kProxyJudgeExpressHost,
        port: 6969,
        path: "/clientip",
      };

      const req = http.get(requestOptions, (res) => {
        this.logger_.info(`getPublicIP status code: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          res.destroy(new Error(ErrorsEnum.STATUS_CODE_ERROR));
        }

        const responseData = [] as Buffer[];
        res.on("data", (data) => responseData.push(data));

        res.on("end", () => {
          this.logger_.info(
            `getPublicIP Network Response: ${new Date().getTime() - startTime}`
          );

          try {
            const clientIP = JSON.parse(Buffer.concat(responseData).toString());
            if (clientIP.hasOwnProperty("clientip")) {
              promiseFlag = true;
              resolve(String(clientIP["clientip"]));
            } else {
              res.destroy(new Error(ErrorsEnum.BAD_RESPONSE));
            }
          } catch (error) {
            this.logger_.error(`getPublicIP JSON Parse Error: ${Error}`);
            res.destroy(new Error(ErrorsEnum.JSON_PARSE_ERROR));
          }
        });

        res.on("close", () => {
          this.logger_.info(
            `getPublicIP Response Time: ${new Date().getTime() - startTime}`
          );
        });

        res.on("error", (error) => {
          this.logger_.error(`getPublicIP Response Error: ${error.message}`);
          promiseFlag = true;
          reject({
            [PCheckerErrors.getPublicIPError]: error.message,
          } as PCheckerErrorObject);
        });
      });

      req.setTimeout(this.timeout_, () => {
        req.destroy(new Error(ErrorsEnum.TIMEOUT));
      });
      
      req.on("error", (error) => {
        this.logger_.error(`getPublicIP Request Error: ${error.message}`);
        promiseFlag = true;
        reject({
          [PCheckerErrors.getPublicIPError]: error.message,
        });
      });
      
      req.on("close", () => {
        this.logger_.info(`HTTP Request Socket Closed (Base): ${new Date().getTime() - startTime}`);
        if (!promiseFlag) {
          reject({
            [PCheckerErrors.getPublicIPError]: ErrorsEnum.UNKNOWN_ERROR,
          });
        }
      });

      req.end();
    });
  }

  // function creates timeout, mem is managed by clearTimeouts()
  protected createTimeout<T>(data: any) {
    const timeoutPromise: Promise<T> = new Promise((resolve) =>
      setTimeout(() => resolve({ timeoutdata: data } as T), this.timeout_)
    );
    this.timeoutsArray_.push(timeoutPromise);

    return timeoutPromise;
  }

  protected createTimeoutNew<T>(data: any) {
    const timeoutPromise: Promise<T> = new Promise((resolve) =>
      setTimeout(() => resolve(data as T), this.timeout_)
    );
    this.timeoutsArray_.push(timeoutPromise);

    return timeoutPromise;
  }

  // timeout memory management
  protected clearTimeouts(): void {
    this.timeoutsArray_.forEach(async (to) => {
      clearTimeout(await to);
    });
  }

  // empty out all values
  protected clearPChecker(): void {
    this.host_ = "";
    this.port_ = "";
    this.timeout_ = 0;
    this.clearTimeouts();
    this.username_ = "";
    this.password_ = "";
    this.updateOptions();
  }

  protected updateOptions(): void {
    if (this.publicIPAddress_ !== undefined) {
      this.publicIPAddress_ = this.publicIPAddress_;
    }

    if (this.username_ !== undefined && this.password_ !== undefined) {
      this.auth_ =
        "Basic " +
        Buffer.from(this.username_ + ":" + this.password_).toString("base64");
    }

    this.optionspj_ = {
      host: this.host_,
      port: Number(this.port_),
      method: "GET",
      path: PCheckerBase.kProxyJudgeURL,
      headers: {
        "User-Agent":
          PCheckerBase.kUserAgents[
            Math.floor(Math.random() * PCheckerBase.kUserAgents.length)
          ],
      },
    };

    if (this.auth_ !== undefined) {
      this.optionspj_.headers = { "Proxy-Authorization": this.auth_ };
    }
  }

  public setHost(host: string): void {
    this.host_ = host;
    this.updateOptions();
  }

  public setPort(port: string): void {
    this.port_ = port;
    this.updateOptions();
  }

  public setTimeout(timeout: string): void {
    this.timeout_ = Number(timeout);
    this.updateOptions();
  }

  public setPublicIP(ip: string): void {
    this.publicIPAddress_ = ip;
    this.updateOptions();
  }

  public setUsername(username: string): void {
    this.username_ = username;
    this.updateOptions();
  }

  public setPassword(password: string): void {
    this.password_ = password;
    this.updateOptions();
  }

  public setRunProxyLocation(runProxyLocation: boolean): void {
    this.runProxyLocation_ = runProxyLocation;
  }

  public turnOffLogger(): void {
    this.logger_.transports.forEach((t) => (t.silent = true));
  }

  protected nullChecks(): void {
    if (this.host_ === undefined || this.host_ === "")
      throw new Error("Host is Empty");
    if (this.port_ === undefined || this.port_ === "")
      throw new Error("Port is Empty");
    if (this.timeout_ === undefined || Number.isNaN(this.timeout_))
      throw new Error("Timeout is Empty");
  }
}
