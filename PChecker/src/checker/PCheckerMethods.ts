"use-strict";

import http from "http";
import net from "net";
import dns from "dns";
import puppeteer, { Browser, Page } from "puppeteer";
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
  PCheckerOptions,
} from "./types.js";
import {
  FlaggedHeaderValuesEnum,
  ProxyAnonymityEnum,
  ErrorsEnum,
  DNSLeakEnum,
  customEnumError,
} from "./emuns.js";
import { PCheckerBase } from "./PCheckerBase.js";

/**
 * @todo
 *  - add more error handling
 *  - checkContent() 302 fix
 *  - SO MANY BUGS WITH EVERYTHING DONT USE
 */
export class PCheckerMethods extends PCheckerBase {
  private socket_: net.Socket;
  private optionsTestDomain_: ProxyOptions;

  // test endpoint
  private static readonly kTestDomain: string = `http://myproxyjudgeclee.software/index.html`;

  /** @todo: move to testing infra */
  // injection testing
  private static readonly injectedTest1: string = `http://myproxyjudgeclee.software/testendpointindex.html`;
  private static readonly injectedTest2: string = `http://myproxyjudgeclee.software/testendpointindex2.html`;

  constructor(pcheckerOptions?: PCheckerOptions) {
    super(pcheckerOptions);

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
        let statuscode: number = 0;
        let response: string[] = [];
        const startTime = new Date().getTime();

        const httpGetRequestObject = () => {
          const httpProxyRequestObject = http.get(
            this.optionsTestDomain_,
            (res) => {
              if (res.statusCode !== 200) {
                this.logger_.error(
                  `checkProxyContent status code: ${res.statusCode}`
                );
                errorObject.error = ErrorsEnum.STATUS_CODE_ERROR;
                res.destroy();
              }

              res.setEncoding("utf8");
              const body = [] as string[];
              res.on("data", (chunk: string) => {
                body.push(chunk);
                this.logger_.info(`checkProxyContent chunk: ${chunk}`);
              });

              res.on("end", () => {
                if (body.length === 0) {
                  if (statuscode === 302) {
                    this.logger_.info(
                      `proxy may have erased all website content on redirect : status code ${statuscode}`
                    );
                  } else {
                    errorObject.error = ErrorsEnum.PROXY_JUDGE_EMPTY_RESPONSE;
                    this.logger_.error(
                      "checkProxyContent empty response from proxy judge"
                    );
                  }
                  res.destroy();
                } else {
                  body[0]
                    .split("\n")
                    .forEach((line: string) => response.push(line.trim()));
                  response = response.filter((v) => v.length !== 0);
                }
              });

              res.on("error", (error) => {
                this.logger_.error(`httpResponse ON-Error: ${error}`);
                errorObject.error = ErrorsEnum.CONNECTION_ERROR;
                res.destroy();
              });

              res.on("close", () => {
                const endtime = new Date().getTime() - startTime;
                this.logger_.info(
                  `checkProxyContent response time: ${endtime}`
                );
                if (errorObject.hasOwnProperty("error")) {
                  // the proxy judge is expected to work
                  if (errorObject.error === ErrorsEnum.STATUS_CODE_ERROR) {
                    this.logger_.error("the proxy judge is failing"); // maybe because its written in php
                    reject(errorObject);
                  }
                  resolve(errorObject);
                }
                resolve(response);
              });
            }
          );

          httpProxyRequestObject.on("error", (error) => {
            errorObject.error = ErrorsEnum.CONNECTION_ERROR;
            this.logger_.error(`checkProxyContent connection error: ${error}`);
            httpProxyRequestObject.destroy();
          });

          httpProxyRequestObject.on("end", () => {
            statuscode = undefined;
          });

          httpProxyRequestObject.on("close", () => {
            const endtime = new Date().getTime() - startTime;
            this.logger_.info(`checkProxyContent response time: ${endtime}`);

            if (errorObject.hasOwnProperty("error")) resolve(errorObject);
            else resolve(response);
          });

          httpProxyRequestObject.end();

          return httpProxyRequestObject;
        };

        httpGetRequestObject();
      }
    );

    const contentCheck: Promise<ProxyContentCheck | ProxyError> = new Promise(
      (resolve, reject) => {
        let content = {} as ProxyContentCheck;
        let response: string[] = [];

        proxyResponse
          .then((res: string[] | ProxyError) => {
            // response type check
            if (res.hasOwnProperty("error")) {
              resolve(res as ProxyError);
            } else {
              response = res as string[];
            }

            // check if data/html has been alter after connecting with proxy server
            const hasChanged = (): boolean => {
              let i = expectedResponse.length;
              while (i--) {
                if (!response[i]) continue;
                if (expectedResponse[i] !== response[i]) {
                  console.log("expected:", expectedResponse[i]);
                  console.log("got:", response[i]);
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
          })
          .catch((error) => {
            this.logger_.error(`checkProxyContent error: ${error}`);
            reject(error);
          });
      }
    );

    try {
      return Promise.race([contentCheck, timeoutPromise]);
    } catch (error) {
      this.logger_.error(`checkProxyContent PromiseRace Error: ${error}`);
      return { error: ErrorsEnum.PROMISE_RACE_ERROR } as ProxyError;
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
        const proxyError = {} as ProxyError;
        const startTime = new Date().getTime();

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

        const httpGetRequestObject = () => {
          const httpProxyRequestObject = http.get(options, (res) => {
            if (res.statusCode !== 200) {
              proxyError.error = ErrorsEnum.STATUS_CODE_ERROR;
              this.logger_.error(`dnsLeak bad status code: ${res.statusCode}`);
              res.destroy();
            }

            res.setEncoding("utf8");
            let data: string = "";
            res.on("data", (chunk) => {
              data += chunk;
            });

            res.on("end", () => {
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
                  proxyError.error = ErrorsEnum.NO_DNS_SERVERS;
                  this.logger_.error(`no dns servers found`);
                  res.destroy();
                }

                parsedData
                  .filter(
                    (server: DNSResponseServer) => server.type === "conclusion"
                  )
                  .forEach((server: DNSResponseServer) => {
                    if (server.ip === "DNS may be leaking.") {
                      dnsLeakCheck.conclusion = DNSLeakEnum.PossibleDNSLeak;
                    } else if (server.ip === "DNS is bot leaking.") {
                      dnsLeakCheck.conclusion = DNSLeakEnum.NoDNSLeak;
                    }
                  });

                resolve(dnsLeakCheck);
              } catch (error) {
                proxyError.error = ErrorsEnum.JSON_PARSE_ERROR;
                this.logger_.error(`dnsLeak JSON Parse Error`);
                res.destroy();
              }
            });

            res.on("error", (error) => {
              proxyError.error = ErrorsEnum.CONNECTION_ERROR;
              this.logger_.error(`dnsLeak connect error: ${error}`);
              res.destroy();
            });

            res.on("close", () => {
              const endtime = new Date().getTime() - startTime;
              this.logger_.info(`dnsLeakCheck run time: ${endtime} ms`);

              if (proxyError.hasOwnProperty("error")) resolve(proxyError);
              resolve(dnsLeakCheck);
            });
          });

          httpProxyRequestObject.on("error", (error) => {
            proxyError.error = ErrorsEnum.CONNECTION_ERROR;
            this.logger_.error(`dns check connection error: ${error}`);
            httpProxyRequestObject.destroy();
          });

          httpProxyRequestObject.on("end", () => {
            dnsLeakCheck.bashWSDomains = undefined;
            dnsLeakCheck.conclusion = undefined;
            dnsLeakCheck.currentServer = undefined;
            dnsLeakCheck.dnsServerCount = undefined;
            dnsLeakCheck.dnsServers = undefined;
          });

          httpProxyRequestObject.on("close", () => {
            const endtime = new Date().getTime() - startTime;
            this.logger_.info(
              `dns check response time: ${endtime - startTime}`
            );

            if (proxyError.hasOwnProperty("error")) resolve(proxyError);
            else resolve(dnsLeakCheck);
          });

          httpProxyRequestObject.end();

          return httpProxyRequestObject;
        };

        httpGetRequestObject();
      }
    );

    try {
      return Promise.race([dnsLeakPromise, timeoutPromise]);
    } catch (error) {
      this.logger_.error(`dns leak check PromiseRace Error: ${error}`);
      return { error: ErrorsEnum.PROMISE_RACE_ERROR } as ProxyError;
    }
  }

  /**
   * @method: checkProxyWebRTCLeak, private helper function
   * @returns: Promise<bool | Error>
   * Check if proxy server will cause a WebRTC leak
   */
  protected async checkProxyWebRTCLeak(): Promise<boolean | ProxyError> {
    const timeoutPromise: Promise<boolean> = this.createTimeout("timedout");

    // creates new WebRTC connection and gather ICE candidates
    const getCandidates = async () => {
      let browser: Browser | null = null;
      let page: Page | null = null;

      try {
        const proxy = `${this.host_}:${this.port_}`;
        browser = await puppeteer.launch({
          args: [`--proxy-server=${proxy}`],
        });

        page = await browser.newPage();

        const candidates = await page.evaluate(() => {
          return new Promise<string[]>((resolve) => {
            const googleStunServers = [
              "stun.l.google.com:19302",
              "stun1.l.google.com:19302",
              "stun2.l.google.com:19302",
              "stun3.l.google.com:19302",
              "stun4.l.google.com:19302",
            ];
            const candidates: string[] = [];
            const pc = new RTCPeerConnection({
              iceServers: [
                {
                  urls: `stun:${
                    googleStunServers[
                      Math.floor(Math.random() * googleStunServers.length)
                    ]
                  }`,
                },
              ],
            });

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                candidates.push(event.candidate.candidate);
              } else {
                // ICE gathering finished, resolve the promise
                resolve(candidates);
              }
            };

            // Create a new data channel (this will trigger ICE gathering)
            pc.createDataChannel("channel");

            // Create an offer (this will trigger ICE gathering in some browsers)
            pc.createOffer().then((offer) => pc.setLocalDescription(offer));
          });
        });
        this.logger_.info(candidates);
        return candidates;
      } catch (error) {
        console.error("An error occurred:", error);
      } finally {
        if (page) await page.close();
        if (browser) await browser.close();
      }
    };

    // checks if leaks public ip address
    const hasLeak = async () => {
      const candidates = await getCandidates();
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (candidate.indexOf(this.publicIPAddress_)) return true;
      }

      return false;
    };

    try {
      return Promise.race([hasLeak(), timeoutPromise]);
    } catch (error) {
      this.logger_.error(`webrtc leak check PromiseRace Error: ${error}`);
      return { error: ErrorsEnum.PROMISE_RACE_ERROR } as ProxyError;
    }
  }
}
