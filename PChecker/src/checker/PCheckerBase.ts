"use-strict";

import http from "http";
import { ProxyOptions, ProxyError } from "./types.js";
import { ENUM_ERRORS } from "./emuns.js";

import { createLogger, transports, format, log } from "winston";

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

export class PCheckerBase {
  protected host_: string;
  protected port_: string;
  protected timeout_: number;
  protected optionspj_: ProxyOptions;
  protected publicIPAddress_: string | Promise<string | ProxyError>;
  protected username_: string;
  protected password_: string;
  protected auth_: string;
  private timeoutsArray_: Array<Promise<any>>;

  protected static readonly kProxyJudgeURL: string = `http://myproxyjudgeclee.software/pj-cleeclee123.php`;

  protected static readonly kUserAgents: string[] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0",
    "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36",
  ];

  constructor(
    host?: string,
    port?: string,
    timeout?: string,
    publicIPAddress?: string | Promise<string | ProxyError>,
    username?: string,
    password?: string
  ) {
    this.host_ = host;
    this.port_ = port;
    this.timeout_ = Number(timeout);
    this.username_ = username;
    this.password_ = password;
    this.optionspj_ = {} as ProxyOptions;
    this.timeoutsArray_ = [] as Array<Promise<any>>;

    // when i implement sign up/login, this will be saved and run only once everyday for every user
    publicIPAddress !== undefined
      ? (this.publicIPAddress_ = publicIPAddress)
      : (this.publicIPAddress_ = this.getPublicIP());

    username !== undefined && password !== undefined
      ? (this.auth_ =
          "Basic " + Buffer.from(username + ":" + password).toString("base64"))
      : (this.auth_ = undefined);

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

  /**
   * @method: getPublicIP(), private helper function
   * @returns Promise<String | Error>
   * Gets Your Public IP Address
   */
  protected getPublicIP(): Promise<string | ProxyError> {
    const timeoutPromise: Promise<string> = this.createTimeout("timedout");

    const responsePromise = new Promise<string | ProxyError>((resolve) => {
      const errorObject = {} as ProxyError;
      let myPublicIP: string = "";
      const requestOptions = {
        host: "api.ipify.org",
        port: 80,
        path: "/",
      };

      http.get(requestOptions, (res) => {
        if (res.statusCode !== 200) {
          errorObject.error = ENUM_ERRORS.StatusCodeError;
          logger.error(`getPublicIP bad status code: ${res.statusCode}`);
          res.destroy();
        }

        res.setEncoding("utf8");
        let responseData = [] as string[];
        res.on("data", (data) => {
          responseData.push(data);
        });

        res.on("end", () => {
          if (
            /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
              responseData.toString()
            )
          ) {
            myPublicIP = responseData.toString();
          } else {
            errorObject.error = ENUM_ERRORS.JSONParseError;
            logger.error(`getPublicIP Regex IP Parse Error`);
          }
          res.destroy();
        });

        res.on("error", (error) => {
          errorObject.error = ENUM_ERRORS.ConnectionError;
          logger.error(`getPublicIP connect error: ${error}`);
          res.destroy();
        });

        res.on("close", () => {
          if (Object.keys(errorObject).length !== 0) resolve(errorObject);
          else resolve(myPublicIP);
        });
      });
    });

    // abiding readiness pattern, returning a promise
    // not awaiting promise here will need to handle this in run()
    try {
      return Promise.race([responsePromise, timeoutPromise]);
    } catch (error) {
      this.publicIPAddress_ = new Promise((resolve) => {
        resolve({ error: ENUM_ERRORS.PromiseRaceError } as ProxyError);
      });
    }
  }

  // function creates timeout, mem is managed by clearTimeouts()
  protected createTimeout<T>(data: any) {
    const timeoutPromise: Promise<T> = new Promise((resolve) =>
      setTimeout(() => resolve({ timeoutdata: data } as T), this.timeout_)
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

  public setTimeout(timeout: number): void {
    this.timeout_ = timeout;
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
}
