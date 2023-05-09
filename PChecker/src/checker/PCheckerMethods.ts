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
  ProxyLocation,
} from "./types.js";
import {
  ENUM_FlaggedHeaderValues,
  ENUM_ProxyAnonymity,
  ENUM_ERRORS,
  ENUM_DNSLeakCheck,
} from "./emuns.js";
import { PCheckerBase } from "./PCheckerBase.js";

export class PCheckerMethods extends PCheckerBase {
  private socket_: net.Socket;
  private optionsTestDomain_: ProxyOptions;

  // test endpoint
  private static readonly kTestDomain: string = `http://myproxyjudgeclee.software/index.html`;

  // injection testing
  // private static readonly injectedTest1: string = `http://myproxyjudgeclee.software/testendpointindex.html`;
  // private static readonly injectedTest2: string = `http://myproxyjudgeclee.software/testendpointindex2.html`;

  constructor(
    host?: string,
    port?: string,
    timeout?: string,
    publicIPAddress?: string,
    username?: string,
    password?: string
  ) {
    super(host, port, timeout, publicIPAddress, username, password);

    this.optionsTestDomain_ = {
      host: this.host_,
      port: Number(this.port_),
      method: "GET",
      path: PCheckerMethods.kTestDomain, 
      headers: {
        "User-Agent":
          PCheckerMethods.kUserAgents[
            Math.floor(Math.random() * PCheckerMethods.kUserAgents.length)
          ],
      },
    };

    if (this.auth_ !== undefined) {
      this.optionsTestDomain_.headers = { "Proxy-Authorization": this.auth_ };
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
            // console.log(`httpRequest Bad Status Code`);
            errorObject.error = ENUM_ERRORS.STATUS_CODE_ERROR;

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
              // console.log(`httpRequest JSON Parse Error: ${error}`);
              errorObject.error = ENUM_ERRORS.JSON_PARSE_ERROR;

              resolve(errorObject);
            }

            resolve(httpRequest);
          });

          res.on("error", (error) => {
            // console.log(`httpRequest ON-Error: ${error}`);
            errorObject.error = ENUM_ERRORS.CONNECTION_ERROR;

            resolve(errorObject);
          });
        });
      }
    );

    // race between timeout and httpsCheck
    try {
      return await Promise.race([timeoutPromise, response]);
    } catch (error) {
      // console.log(`httpRequest PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PROMISE_RACE_ERROR } as ProxyError;
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
            // console.log("socket connected");
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
              resolve({ error: ENUM_ERRORS.EMPTY_SOCKET_RESPONSE } as ProxyError);
            }

            //this.socket_.destroy();
            resolve(httpsRequest);
          });

          // todo: better/more specifc error handling
          this.socket_.on("error", (error) => {
            this.socket_.destroy();
            resolve({ error: ENUM_ERRORS.SOCKET_ERROR } as ProxyError);
          });
        };

        // shamelessly taken from https://github.com/TooTallNate/node-https-proxy-agent/blob/master/src/parse-proxy-response.ts
        const onData = () => {
          this.socket_.on("data", (chuck: Buffer) => {
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
            httpsRequest.response = buffered.toString(
              "ascii",
              0,
              buffered.indexOf("\r\n")
            );

            // parse status code from response
            httpsRequest.statusCode = Number(
              +httpsRequest.response.split(" ")[1]
            );

            // console.log("socket status code ", httpsRequest.statusCode);

            // resolve right away if status code is not 200
            // 403 status code may hint at https support with auth
            // 500 status code may hint at https support
            if (httpsRequest.statusCode !== 200) {
              resolve({ error: ENUM_ERRORS.STATUS_CODE_ERROR } as ProxyError);
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
      // console.log(`httpsCheck PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PROMISE_RACE_ERROR } as ProxyError;
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

        http.get(this.optionsTestDomain_, (res) => {
          if (res.statusCode !== 200) {
            // console.log(`httpRequest Bad Status Code ${res.statusCode}`);
            errorObject.error = ENUM_ERRORS.STATUS_CODE_ERROR;

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
            // console.log(`httpResponse ON-Error: ${error}`);
            errorObject.error = ENUM_ERRORS.CONNECTION_ERROR;

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
      // console.log(`content check PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PROMISE_RACE_ERROR } as ProxyError;
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
          // console.log(res.statusCode);
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
      // console.log(`google check PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PROMISE_RACE_ERROR } as ProxyError;
    }
  }

  /**
   * @method: checkProxyGoogleSupport(), private helper function
   * @returns: Promise<any | Error>
   * Check if proxy works with google
   */
  protected async checkProxyLocation(): Promise<ProxyLocation | ProxyError> {
    const timeoutPromise: Promise<ProxyLocation> =
      this.createTimeout("timedout");

    const requestOptions = {
      host: this.host_,
      port: Number(this.port_),
      path: `http://ip-api.com/json/${this.host_}`,
      headers: {
        "User-Agent":
          PCheckerMethods.kUserAgents[
            Math.floor(Math.random() * PCheckerMethods.kUserAgents.length)
          ],
      },
    };

    const geolocationPromise: Promise<ProxyLocation | ProxyError> = new Promise(
      (resolve, reject) => {
        const geolocation = {} as ProxyLocation;

        http.get(requestOptions, (res) => {
          // console.log(res.statusCode);
          if (res.statusCode !== 200) {
            resolve({ error: ENUM_ERRORS.STATUS_CODE_ERROR } as ProxyError);
          }
          console.log(res.headers);

          res.setEncoding("utf8");
          let responseData = [] as any;
          res.on("data", (data) => {
            responseData.push(data);
          });

          res.on("end", () => {
            try {
              geolocation.data = JSON.parse(responseData.join(""));
              resolve(geolocation);
            } catch (error) {
              resolve({ error: ENUM_ERRORS.JSON_PARSE_ERROR } as ProxyError);
            }
          });
        });
      }
    );

    try {
      return await Promise.race([geolocationPromise, timeoutPromise]);
    } catch (error) {
      // console.log(`google check PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PROMISE_RACE_ERROR } as ProxyError;
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

              const currentServer = parsedData.filter(
                (server: DNSResponseServer) => server.type === "ip"
              );
              dnsLeakCheck.currentServer = currentServer;

              const dnsServers = parsedData.filter(
                (server: DNSResponseServer) => server.type === "dns"
              );
              dnsLeakCheck.dnsServers = dnsServers;

              const dnsServersCount = dnsServers.length;
              dnsLeakCheck.dnsServerCount = dnsServersCount;

              if (dnsServersCount === 0) {
                // console.log("No DNS servers found");
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
              // console.log(`DNS Leak Check Error: ${error}`);
              resolve({} as ProxyDNSCheck);
            }
          });
        });
      }
    );

    try {
      return await Promise.race([dnsLeakPromise, timeoutPromise]);
    } catch (error) {
      // console.log(`dns leak check PromiseRace Error: ${error}`);
      return { error: ENUM_ERRORS.PROMISE_RACE_ERROR } as ProxyError;
    }
  }

  // /**
  //  * @method: checkProxyWebRTCLeak, private helper function
  //  * @returns: Promise<bool | Error>
  //  * Check if proxy server will cause a WebRTC leak (BASH.WS is goat)
  //  */
  // protected async checkProxyWebRTCLeak(): Promise<boolean | ProxyError> {
  //   const timeoutPromise: Promise<boolean> = this.createTimeout("timedout");

  //   const endpointOptions = {
  //     host: this.host_,
  //     port: Number(this.port_),
  //     path: "http://myproxyjudgeclee.software:8181/webleakcheck",
  //     headers: {
  //       "User-Agent":
  //         PCheckerMethods.kUserAgents[
  //           Math.floor(Math.random() * PCheckerMethods.kUserAgents.length)
  //         ],
  //     },
  //   };

  //   const webrtcCheckPromise: Promise<boolean | ProxyError> = new Promise(
  //     (resolve, reject) => {
  //       http.get(endpointOptions, (res) => {
  //         // // console.log(res.statusCode);
  //         if (res.statusCode !== 200) {
  //           resolve(false);
  //         }

  //         res.on("data", (data) => {
  //           // // console.log(data.toString());
  //         });

  //       });
  //     }
  //   );

  //   try {
  //     return await Promise.race([webrtcCheckPromise, timeoutPromise]);
  //   } catch (error) {
  //     // console.log(`google check PromiseRace Error: ${error}`);
  //     return { error: ENUM_ERRORS.PromiseRaceError } as ProxyError;
  //   }
  // }
}
