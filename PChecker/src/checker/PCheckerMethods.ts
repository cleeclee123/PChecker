"use-strict";

import http from "http";
import net from "net";
import dns from "dns";
import puppeteer, { Browser, Page } from "puppeteer";
import { promisify } from "util";
import { spawn } from "child_process";
import {
  ProxyError,
  ProxyContentCheck,
  ProxyDNSCheck,
  DNSResponseServer,
  PCheckerOptions,
  PCheckerErrorObject,
  DNSInfo,
  DNSLeakCheckPyScript,
} from "./types.js";
import { ErrorsEnum, DNSLeakEnum, PCheckerErrors } from "./emuns.js";
import { PCheckerBase } from "./PCheckerBase.js";
import * as dotenv from "dotenv";
import { child } from "winston";

dotenv.config();

/**
 * @todo
 *  - add more error handling
 *  - checkContent() 302 fix
 *  - SO MANY BUGS WITH EVERYTHING DONT USE
 */
export class PCheckerMethods extends PCheckerBase {
  private static readonly kTestDomain: string = process.env.PROXY_CONTENT_CHECK;
  private static readonly injectedTest1: string =
    process.env.PROXY_INJECTED_CHECK_1;
  private static readonly injectedTest2: string =
    process.env.PROXY_INJECTED_CHECK_1;

  constructor(pcheckerOptions?: PCheckerOptions) {
    super(pcheckerOptions);
  }

  /**
   * @method: checkProxyContent(), private helper function
   * @returns: Promise<any | Error>
   * Check if proxy injects something (scripts, ads, modified data, etc)
   */
  protected async checkProxyContent(): Promise<ProxyContentCheck> {
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

    const proxyResponse: Promise<string[]> = new Promise((resolve, reject) => {
      let statuscode: number = 0;
      let content: string[] = [];
      const startTime = new Date().getTime();

      const httpGetRequestObject = () => {
        const reqOptions = {
          host: this.host_,
          port: Number(this.port_),
          path: PCheckerMethods.kTestDomain,
        };

        const req = http.request(reqOptions, (res) => {
          statuscode = res.statusCode;
          if (res.statusCode !== 200) {
            this.logger_.error(
              `checkProxyContent status code: ${res.statusCode}`
            );
            res.resume();
            res.destroy(new Error(ErrorsEnum.STATUS_CODE_ERROR));
          }

          const body = [] as Buffer[];
          res.on("data", (chunk: Buffer) => {
            body.push(chunk);
            this.logger_.info(`checkProxyContent chunk: ${chunk}`);
          });

          res.on("end", () => {
            if (body.length === 0) {
              if (statuscode === 302) {
                this.logger_.info(
                  `proxy may have erased all website content on redirect : status code ${statuscode}`
                );
              }
              res.destroy(new Error(ErrorsEnum.EMPTY_RESPONSE));
              return;
            }

            Buffer.concat(body)
              .toString()
              .split("\n")
              .forEach((line: string) => content.push(line.trim()));
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
            const endtime = new Date().getTime() - startTime;
            this.logger_.info(`checkProxyContent response time: ${endtime}`);
            resolve(content);
          });
        });

        req.on("error", (error) => {
          this.logger_.error(`checkProxyContent connection error: ${error}`);
          reject({
            [PCheckerErrors.checkAnonymityError]: ErrorsEnum.SOCKET_ERROR,
          } as PCheckerErrorObject);
        });

        req.on("end", () => {
          statuscode = undefined;
        });

        req.on("close", () => {
          this.logger_.info(`HTTP Request Socket Closed: (Content Check)`);
        });

        req.end();

        return req;
      };

      httpGetRequestObject();
    });

    const contentCheck: Promise<ProxyContentCheck> = new Promise(
      (resolve, reject) => {
        let content = {} as ProxyContentCheck;
        let response: string[] = [];

        proxyResponse
          .then((res: string[]) => {
            // response type check
            response = res as string[];

            // check if data/html has been alter after connecting with proxy server
            const hasChanged = (): boolean => {
              let i = expectedResponse.length;
              while (i--) {
                if (!response[i]) continue;
                if (expectedResponse[i] !== response[i]) {
                  this.logger_.info(
                    `expected: ${expectedResponse[i]} | got: ${response[i]}`
                  );
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

            // forward the error to the promise race trycatch below lol
            reject(error);
          });
      }
    );

    try {
      return await Promise.race([contentCheck, timeoutPromise]);
    } catch (error) {
      return { error: error };
    }
  }

  /**
   * @method: checkProxyDNSLeak, private helper function
   * @returns: Promise<bool | Error>
   * Check if proxy server will cause a DNS leak (BASH.WS is goat)
   */
  protected async checkProxyDNSLeak(): Promise<ProxyDNSCheck> {
    const timeoutPromise: Promise<ProxyDNSCheck> =
      this.createTimeout("timeout");

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

    const dnsLeakPromise: Promise<ProxyDNSCheck> = new Promise(
      async (resolve, reject) => {
        const dnsLeakCheck = {} as ProxyDNSCheck;
        const errorsSet = new Set<ErrorsEnum>();
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

        const req = http.get(options, (res) => {
          if (res.statusCode !== 200) {
            errorsSet.add(ErrorsEnum.STATUS_CODE_ERROR);
            res.destroy(new Error(ErrorsEnum.STATUS_CODE_ERROR));
          }

          const buffer = [] as Buffer[];
          res.on("data", (chunk) => {
            buffer.push(chunk);
          });

          res.on("end", () => {
            try {
              console.log(Buffer.concat(buffer).toString());
              const parsedData = JSON.parse(Buffer.concat(buffer).toString());

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
                errorsSet.add(ErrorsEnum.NO_DNS_SERVERS);
                res.destroy(new Error(ErrorsEnum.NO_DNS_SERVERS));
                return;
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
              errorsSet.add(ErrorsEnum.JSON_PARSE_ERROR);
              res.destroy(new Error(ErrorsEnum.JSON_PARSE_ERROR));
            }
          });

          res.on("error", (error) => {
            if (error.message in ErrorsEnum) {
              reject(error.message);
            } else {
              errorsSet.add(ErrorsEnum.CONNECTION_ERROR);
              reject(ErrorsEnum.CONNECTION_ERROR);
            }
          });

          res.on("close", () => {
            const endtime = new Date().getTime() - startTime;
            this.logger_.info(`dnsLeakCheck run time: ${endtime} ms`);

            resolve(dnsLeakCheck);
          });
        });

        req.on("error", (error) => {
          if (error.message in ErrorsEnum) {
            reject(error.message);
          } else {
            errorsSet.add(ErrorsEnum.CONNECTION_ERROR);
            reject(ErrorsEnum.CONNECTION_ERROR);
          }
        });

        req.on("end", () => {
          dnsLeakCheck.bashWSDomains = undefined;
          dnsLeakCheck.conclusion = undefined;
          dnsLeakCheck.currentServer = undefined;
          dnsLeakCheck.dnsServerCount = undefined;
          dnsLeakCheck.dnsServers = undefined;
        });

        req.on("close", () => {
          const endtime = new Date().getTime() - startTime;
          this.logger_.info(`dns check response time: ${endtime}`);
        });

        req.end();
      }
    );

    try {
      return await Promise.race([dnsLeakPromise, timeoutPromise]);
    } catch (error) {
      this.logger_.error(`dns leak check error: ${error}`);
      return { error: error };
    }
  }

  /**
   * @method: checkProxyDNSLeak_PythonScript, private helper function
   * @returns: Promise<bool | Error>
   * Check if proxy server will cause a DNS leak, spawning a child process and running python script
   */
  protected async checkProxyDNSLeak_PythonScript(
    subdomainCount = 10,
    httpsStatus?: boolean
  ) /* : Promise<ProxyDNSCheck> */ {
    const timeoutPromise: Promise<boolean> = this.createTimeout("timeout");

    let arg4 = httpsStatus ? "true" : "false";
    if (httpsStatus === undefined) arg4 = undefined;

    const mapArrayToType = <T extends Record<string, any>>(
      arr: any[],
      keys: (keyof T)[]
    ): T => {
      const result = {} as T;
      keys.forEach((key, index) => {
        result[key] = arr[index];
      });
      return result;
    };

    const childProcessPromise = new Promise((resolve, reject) => {
      const dnsLeakScriptResults = {} as DNSLeakCheckPyScript;

      const pythonProcess = spawn("python", [
        "./src/utils/dns_leak_script.py",
        this.host_,
        this.port_,
        String(subdomainCount),
        arg4,
      ]);

      const bufferStdout = [] as Buffer[];
      pythonProcess.stdout.on("data", (data) => bufferStdout.push(data));

      const bufferStderr = [] as Buffer[];
      pythonProcess.stderr.on("data", (data) => bufferStderr.push(data));

      pythonProcess.on("close", (code) => {
        this.logger_.info(`Process exited with Code: ${code}`);
        if (code !== 0) {
          reject(ErrorsEnum.CHILD_PROCESS_ERROR);
          return;
        }

        if (bufferStderr.length > 0) {
          this.logger_.error(
            JSON.parse(Buffer.concat(bufferStderr).toString())
          );
          reject(ErrorsEnum.DNS_LEAK_SCRIPT_ERROR);
          return;
        }

        const results = JSON.parse(Buffer.concat(bufferStdout).toString());
        const dnsLeakInfoKeys: (keyof DNSInfo)[] = ["ip", "country", "isp"];

        dnsLeakScriptResults.client_ip = mapArrayToType(
          results["client_ip"],
          dnsLeakInfoKeys
        );
        dnsLeakScriptResults.dns_servers_used_count =
          results["dns_servers_used_count"];
        dnsLeakScriptResults.dns_servers_used = (
          results["dns_servers_used"] as string[]
        ).map((e: any) => mapArrayToType(e, dnsLeakInfoKeys));
        dnsLeakScriptResults.conclusion = results["conclusion"];
        dnsLeakScriptResults.performance = results["performance"];

        resolve(dnsLeakScriptResults);
      });
    });

    try {
      return await Promise.race([childProcessPromise, timeoutPromise]);
    } catch (error) {
      return { error: error };
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
