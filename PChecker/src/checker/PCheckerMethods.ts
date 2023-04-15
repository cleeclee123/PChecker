"use-strict";

import http from "http";
import net from "net";
import dns from "dns";
import { promisify } from "util";
import {
  ProxyOptions,
  ProxyError,
  ProxyInfoFromHttp,
  ProxyInfoFromHttps,
  ProxyContentCheck,
  ProxyDNSCheck,
  DNSResponseServer,
} from "./types.js";
import {
  ENUM_FlaggedHeaderValues,
  ENUM_ProxyAnonymity,
  ENUM_ERRORS,
  ENUM_DNSLeakCheck,
} from "./emuns.js";

export class PCheckerMethods {
  public host_: string;
  public port_: string;
  public timeout_: number;
  protected optionspj_: ProxyOptions;
  protected optionstd_: ProxyOptions;
  private publicIPAddress_: string | Promise<string | ProxyError>;
  private auth_: string;
  private timeoutsArray_: Array<Promise<any>>;
  private socket_: net.Socket;

  static readonly kProxyJudgeURL: string = `http://myproxyjudgeclee.software/pj-cleeclee123.php`;
  static readonly kTestDomain: string = `http://myproxyjudgeclee.software/index.html`;

  static readonly kUserAgents: string[] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0",
    "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36",
  ];

  // injection testing
  static readonly injectedTest1: string = `http://myproxyjudgeclee.software/testendpointindex.html`;
  static readonly injectedTest2: string = `http://myproxyjudgeclee.software/testendpointindex2.html`;

  constructor(
    host: string,
    port: string,
    timeout: string,
    publicIPAddress?: string | Promise<string | ProxyError>,
    username?: string,
    password?: string
  ) {
    this.host_ = host;
    this.port_ = port;
    this.timeout_ = Number(timeout);
    this.optionspj_ = {} as ProxyOptions;
    this.optionstd_ = {} as ProxyOptions;
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
      path: PCheckerMethods.kProxyJudgeURL,
      headers: {
        "User-Agent":
          PCheckerMethods.kUserAgents[
            Math.floor(Math.random() * PCheckerMethods.kUserAgents.length)
          ],
      },
    };

    this.optionstd_ = {
      host: this.host_,
      port: Number(this.port_),
      method: "GET",
      path: PCheckerMethods.kTestDomain, // @TODO: CHANGE BACK TO kTestDomain
      headers: {
        "User-Agent":
          PCheckerMethods.kUserAgents[
            Math.floor(Math.random() * PCheckerMethods.kUserAgents.length)
          ],
      },
    };

    if (this.auth_ !== undefined) {
      this.optionspj_.headers = { "Proxy-Authorization": this.auth_ };
      this.optionstd_.headers = { "Proxy-Authorization": this.auth_ };
    }
  }

  /**
   * @method: checkProxyAnonymity(), private helper function
   * @returns Promise<ProxyInfo | Error>
   * connects to proxy judge through http proxy, strips and scans response headers, checks time to connect
   */
  protected async checkProxyAnonymity(): Promise<
    ProxyInfoFromHttp | ProxyError
  > {
    const timeoutPromise: Promise<ProxyInfoFromHttp> =
      this.createTimeout("timedout");
    // kind slow, difference between response time of proxy connection and runtime is signficant if client ip address is not passed into constructor
    let resolvedPIP = await this.publicIPAddress_;

    const response: Promise<ProxyInfoFromHttp | ProxyError> = new Promise(
      (resolve, reject) => {
        let httpRequest = {} as ProxyInfoFromHttp;
        let errorObject = {} as ProxyError;
        let startTime = new Date().getTime();

        http.get(this.optionspj_, (res) => {
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
                    resolvedPIP !== undefined ||
                    resolvedPIP !== ({} as any)
                  ) {
                    if (
                      String(httpRequest.header[key as keyof JSON]) ===
                      String(resolvedPIP)
                    ) {
                      pipCount++;
                    }
                  } else if (
                    Object.keys(resolvedPIP).length === 0 &&
                    resolvedPIP.constructor === Object
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
              res.destroy();
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
      return { error: ENUM_ERRORS.PromiseRaceError } as ProxyError;
    }
  }

  /**
   * @method: checkProxyHTTPSSupport(), private helper function
   * @returns Promise<ProxyInfoFromHTTPS | ProxyError>
   * tries a HTTP CONNECT method
   */
  protected async checkProxyHTTPSSupport(): Promise<
    ProxyInfoFromHttps | ProxyError
  > {
    const timeoutPromise: Promise<ProxyInfoFromHttps> =
      this.createTimeout("timedout");

    const bufferPromise: Promise<ProxyInfoFromHttps | ProxyError> = new Promise(
      (resolve, reject) => {
        let httpsRequest = {} as ProxyInfoFromHttps;
        let startTime = new Date().getTime();
        let buffersLength: number = 0;
        const buffers = [] as Buffer[];

        // create a socket connection to the proxy server
        const socketConnect = () => {
          this.socket_ = net.connect({
            host: this.host_,
            port: Number(this.port_),
          });

          // requests a http tunnel to be open https://en.wikipedia.org/wiki/HTTP_tunnel
          let payload = `CONNECT ${this.host_}:${Number(
            this.port_
          )} HTTP/1.1\r\n`;

          this.socket_.on("connect", () => {
            this.socket_.write(`${payload}\r\n`);
            console.log("socket connected");
          });

          // dont need to buffer any traffic before proxy connect
          // onData will reject all non-200 res from server =>
          // meaning/confirming server has no https support
          onData();

          // handle everything else below:
          // check response at socket end
          this.socket_.on("end", () => {});

          // resolve when socket is close, we destory after seeing sucessful status code
          this.socket_.on("close", () => {
            httpsRequest.responseTime = new Date().getTime() - startTime;

            // handle empty response here
            if (
              !httpsRequest.statusCode ||
              !httpsRequest.responseTime ||
              !httpsRequest.response
            ) {
              resolve({ error: ENUM_ERRORS.EmptySocketResponse } as ProxyError);
            }

            //this.socket_.destroy();
            resolve(httpsRequest);
          });

          // todo: better/more specifc error handling
          this.socket_.on("error", (error) => {
            this.socket_.destroy();
            resolve({ error: ENUM_ERRORS.SocketError } as ProxyError);
          });
        };

        // shamelessly taken from https://github.com/TooTallNate/node-https-proxy-agent/blob/master/src/parse-proxy-response.ts
        const onData = () => {
          this.socket_.on("data", (chuck: Buffer) => {
            console.log(chuck.toLocaleString());
            buffers.push(chuck);
            buffersLength += chuck.length;

            const buffered = Buffer.concat(buffers, buffersLength);
            const endOfHeaders = buffered.indexOf("\r\n\r\n");

            // will contine to buffer
            if (endOfHeaders === -1) {
              return;
            }

            // parse actual response, usually something like: "HTTP/1.1 200 Connection established"
            httpsRequest.response = buffered.toString(
              "ascii",
              0,
              buffered.indexOf("\r\n")
            );

            // parse status code from response
            httpsRequest.statusCode = Number(
              +httpsRequest.response.split(" ")[1]
            );

            console.log("socket status code ", httpsRequest.statusCode);

            // resolve right away if status code is not 200
            // 403 status code may hint at https support with auth
            // 500 status code may hint at https support
            if (httpsRequest.statusCode !== 200) {
              resolve({ error: ENUM_ERRORS.StatusCodeError } as ProxyError);
            } else {
              // handle 200 res on close
              this.socket_.destroy();
            }
          });
        };

        socketConnect();
      }
    );

    try {
      return await Promise.race([bufferPromise, timeoutPromise]);
    } catch (error) {
      console.log(`httpsCheck PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PromiseRaceError } as ProxyError;
    }
  }

  /**
   * @method: checkProxyContent(), private helper function
   * @returns: Promise<any | Error>
   * Check if proxy injects something (scripts, ads, modified data, etc)
   */
  protected async checkProxyContent(): Promise<ProxyContentCheck | ProxyError> {
    const timeoutPromise: Promise<ProxyContentCheck> =
      this.createTimeout("timedout");

    const expectedResponse: string[] = [
      `<!DOCTYPE html>`,
      `<html lang="en">`,
      `<body>`,
      `<p>roses are red violets are blue if this text is changed then proxy no bueno </p>`,
      `</body>`,
      `</html>`,
    ];

    const proxyResponse: Promise<string[] | ProxyError> = new Promise(
      (resolve, reject) => {
        let errorObject = {} as ProxyError;

        http.get(this.optionstd_, (res) => {
          if (res.statusCode !== 200) {
            console.log(`httpRequest Bad Status Code ${res.statusCode}`);
            errorObject.error = ENUM_ERRORS.StatusCodeError;

            resolve(errorObject);
          }

          res.setEncoding("utf8");
          let response: string[] = [];
          let body = [] as string[];
          res.on("data", (chunk: string) => {
            body.push(chunk);

            let split = body[0].split("\n");
            split.forEach((line: string) => response.push(line.trim()));
            response = response.filter((v) => v.length !== 0);
          });

          res.on("close", () => {
            resolve(response);
          });

          res.on("end", () => {});

          res.on("error", (error) => {
            console.log(`httpResponse ON-Error: ${error}`);
            errorObject.error = ENUM_ERRORS.ConnectionError;

            resolve(errorObject);
          });
        });
      }
    );

    const contentCheck: Promise<ProxyContentCheck | ProxyError> = new Promise(
      (resolve, reject) => {
        let content = {} as ProxyContentCheck;
        let response: string[] = [];

        proxyResponse.then((res: string[] | ProxyError) => {
          // response type check
          if (res.hasOwnProperty("error")) {
            resolve(res as ProxyError);
          } else {
            response = res as string[];
          }

          // check if data/html has been alter after connecting with proxy server
          const hasChanged = (): boolean => {
            // console.log(response);
            // console.log(expectedResponse);
            let i = expectedResponse.length;
            while (i--) {
              if (expectedResponse[i] !== response[i]) {
                return true;
              }
            }
            return false;
          };

          // check if data/html has any suspicious patterns
          // reference: https://www.acunetix.com/vulnerabilities/web/html-injection/
          // prettier-ignore
          const hasSuspicious = () /*:  boolean */ => {
            response.forEach((e) => {
              if (/<script[^>]*>/i.test(e)) content.hasScripts = true;
              if (/<iframe[^>]*>/i.test(e)) content.hasIframes = true;
              if (/<div[^>]*>/i.test(e)) content.hasUnwantedContent = true;
              if (/(class|id)\s*=\s*["'][^"']*ad[^"']*["']/i.test(e)) content.hasAds = true;
              if (/(class|id)\s*=\s*["'][^"']*?(?:ad|banner|popup|interstitial|advert)[^"']*?["']/i) content.hasAds = true;
              if (/<script>.*eval\s*\(.*<\/script>/.test(e)) content.hasExecution = true;
              if (/data:text\/(html|javascript);base64,/i.test(e)) content.hasEncodedContent = true;
              if (/\s+on[a-z]+ *= *["']?[^"'>]+["']?/i.test(e)) content.hasEventHandler = true;
              if (/(?:eval|document\.write|setTimeout|setInterval)\s*\(/i.test(e)) content.hasFunctions = true;
              if (/(?:http:\/\/|https:\/\/|\/\/)[\w-_.]+(?:\.[\w-_]+)+/i.test(e)) content.hasRedirect = true;
              if (/(?:googlesyndication\.com|doubleclick\.net|google-analytics\.com)/i.test(e)) content.hasTracker = true;
              if (/(?:coinhive\.min\.js|coinhive\.com)/i.test(e)) content.hasMiner = true;
            });

            resolve(content);
          };

          // no needs to run hasSuspicious() if not changed
          if (hasChanged()) {
            content.hasChanged = true;
            hasSuspicious();
          } else {
            content.hasChanged = false;
            resolve(content);
          }
        });
      }
    );

    try {
      return await Promise.race([contentCheck, timeoutPromise]);
    } catch (error) {
      console.log(`content check PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PromiseRaceError } as ProxyError;
    }
  }

  /**
   * @method: checkProxyGoogleSupport(), private helper function
   * @returns: Promise<any | Error>
   * Check if proxy works with google
   */
  protected async checkProxyGoogleSupport(): Promise<boolean | ProxyError> {
    const timeoutPromise: Promise<boolean> = this.createTimeout("timedout");

    const googleOptions = {
      host: this.host_,
      port: Number(this.port_),
      path: "https://www.google.com/",
      headers: {
        "User-Agent":
          PCheckerMethods.kUserAgents[
            Math.floor(Math.random() * PCheckerMethods.kUserAgents.length)
          ],
      },
    };

    const googlePromise: Promise<boolean | ProxyError> = new Promise(
      (resolve, reject) => {
        http.get(googleOptions, (res) => {
          console.log(res.statusCode);
          if (res.statusCode !== 200) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      }
    );

    try {
      return await Promise.race([googlePromise, timeoutPromise]);
    } catch (error) {
      console.log(`google check PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PromiseRaceError } as ProxyError;
    }
  }

  /**
   * @method: checkProxyDNSLeak, private helper function
   * @returns: Promise<bool | Error>
   * Check if proxy server will cause a DNS leak (BASH.WS is goat)
   */
  protected async checkProxyDNSLeak(): Promise<ProxyDNSCheck | ProxyError> {
    const timeoutPromise: Promise<ProxyDNSCheck> =
      this.createTimeout("timedout");

    const dnsResolve = promisify(dns.resolve4);
    async function ping(host: any) {
      try {
        await dnsResolve(host);
        return true;
      } catch (error) {
        return false;
      }
    }

    function generateRandomNumber(min: any, max: any) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    const dnsLeakPromise: Promise<ProxyDNSCheck | ProxyError> = new Promise(
      async (resolve, reject) => {
        const dnsLeakCheck = {} as ProxyDNSCheck;

        const leakId = generateRandomNumber(1000000, 9999999);
        let domains: string[] = [];
        for (let x = 0; x < 10; x++) {
          domains.push(`${x}.${leakId}.bash.ws`);
          await ping(`${x}.${leakId}.bash.ws`);
        }
        dnsLeakCheck.bashWSDomains = domains;

        const options = {
          host: this.host_,
          port: Number(this.port_),
          path: `https://bash.ws/dnsleak/test/${leakId}?json`,
        };

        http.get(options, (response) => {
          let data = "";
          response.on("data", (chunk) => {
            data += chunk;
          });

          response.on("end", () => {
            try {
              const parsedData = JSON.parse(data);

              const dnsServers = parsedData.filter(
                (server: DNSResponseServer) => server.type === "dns"
              );
              dnsLeakCheck.dnsServers = dnsServers;

              const dnsServersCount = dnsServers.length;
              dnsLeakCheck.dnsServerCount = dnsServersCount;

              if (dnsServersCount === 0) {
                console.log("No DNS servers found");
                resolve({} as ProxyDNSCheck);
              }

              parsedData
                .filter(
                  (server: DNSResponseServer) => server.type === "conclusion"
                )
                .forEach((server: DNSResponseServer) => {
                  if (server.ip === "DNS may be leaking.") {
                    dnsLeakCheck.conclusion = ENUM_DNSLeakCheck.PossibleDNSLeak;
                  } else if (server.ip === "DNS is bot leaking.") {
                    dnsLeakCheck.conclusion = ENUM_DNSLeakCheck.NoDNSLeak;
                  }
                });

              resolve(dnsLeakCheck);
            } catch (error) {
              console.log(`DNS Leak Check Error: ${error}`);
              resolve({} as ProxyDNSCheck);
            }
          });
        });
      }
    );

    try {
      return await Promise.race([dnsLeakPromise, timeoutPromise]);
    } catch (error) {
      console.log(`dns leak check PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PromiseRaceError } as ProxyError;
    }
  }

  /**
   * @method: checkProxyWebRTCLeak, private helper function
   * @returns: Promise<bool | Error>
   * Check if proxy server will cause a WebRTC leak (BASH.WS is goat)
   */
  protected checkProxyWebRTCLeak() /* : Promise<any | Error> */ {}

  /**
   * @method: getPublicIP(), private helper function
   * @returns Promise<String | Error>
   * Gets Your Public IP Address
   */
  private getPublicIP(): Promise<string | ProxyError> {
    const timeoutPromise: Promise<string> = this.createTimeout("timedout");
    const pipPromise: Promise<string | ProxyError> = new Promise(
      (resolve, reject) => {
        http.get({ host: "api.ipify.org", port: 80, path: "/" }, (resp) => {
          resp.on("data", (ip) => {
            resolve(String(ip));
          });

          resp.on("error", (err) => {
            console.log(`pip constructor ON-Error: ${err}`);
            resolve({ error: ENUM_ERRORS.ConnectionError } as ProxyError);
          });
        });
      }
    );

    // abiding readiness pattern, returning a promise
    // not awaiting promise here will need to handle this in run()
    try {
      return Promise.race([pipPromise, timeoutPromise]);
    } catch (error) {
      this.publicIPAddress_ = new Promise((resolve) => {
        resolve({ error: ENUM_ERRORS.PromiseRaceError } as ProxyError);
      });
    }
  }

  // function creates timeout, mem is managed by clearTimeouts()
  private createTimeout<T>(data: any) {
    const timeoutPromise: Promise<T> = new Promise((resolve) =>
      setTimeout(() => resolve({ timeoutdata: data } as T), this.timeout_)
    );
    this.timeoutsArray_.push(timeoutPromise);

    return timeoutPromise;
  }

  // timeout memory management
  protected clear(): void {
    this.timeoutsArray_.forEach(async (to) => {
      clearTimeout(await to);
    });
  }
}
