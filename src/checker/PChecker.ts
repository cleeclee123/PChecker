import fetch from "node-fetch";
import {
  curlPingConfig,
  ProxyCheck,
  HTTPSCheck,
  PingCheck,
  ProxyHeaders,
  ENUM_ProxyAnonymity,
  ENUM_FlaggedHeaderValues,
  ProxyLocation,
  fetchConfig,
} from "./constants.js";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import pidusage from "pidusage";
import * as readline from "readline";
import http from "http";
import * as dotenv from "dotenv";
dotenv.config();

class SpawnProcess {
  public httpsProcess_: ChildProcessWithoutNullStreams;
  public pingProcess_: ChildProcessWithoutNullStreams;
  public proxyProcess_: ChildProcessWithoutNullStreams;
  public superThis_: PChecker;

  constructor(superThis: PChecker) {
    this.superThis_ = superThis;

    this.httpsProcess_ =
      spawn(
        "curl",
        [
          "-s",
          "-o",
          "/dev/null",
          "-w",
          "%{http_code}",
          "-p",
          "-x",
          `http://${this.superThis_.host_}:${this.superThis_.port_}`,
          `${PChecker.kProxyJudgeURL}`,
        ],
        { timeout: superThis.timeout_ }
      ) || ({} as ChildProcessWithoutNullStreams);

    this.pingProcess_ =
      spawn(
        "curl",
        [
          "-s",
          "-o",
          "/dev/null",
          "-w",
          curlPingConfig,
          "--proxy",
          `http://${this.superThis_.host_}:${this.superThis_.port_}`,
          `${PChecker.kProxyJudgeURL}`,
        ],
        { timeout: superThis.timeout_ }
      ) || ({} as ChildProcessWithoutNullStreams);

    this.proxyProcess_ =
      spawn(
        "curl",
        [
          "-s",
          `-H`,
          `Proxy-Connection:`,
          "--proxy",
          `http://${this.superThis_.host_}:${this.superThis_.port_}`,
          `${PChecker.kProxyJudgeURL}`,
          `-v`,
        ],
        { timeout: superThis.timeout_ }
      ) || ({} as ChildProcessWithoutNullStreams);
  }
}

type Checker = {
  httpsCheck: HTTPSCheck;
  pingCheck: PingCheck;
  proxyCheck: ProxyCheck;
  googleCheck: boolean;
  location: ProxyLocation;
};

/** @todo: KILL ALL PROCESSES AFTER PROMISE.ALL in constructor  */
export class PChecker {
  public host_: string;
  public port_: string;
  public timeout_: number;
  public spawnProcesses_: SpawnProcess;
  static readonly kProxyJudgeURL: string = `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`;

  constructor(host: string, port: string, timeout: number) {
    this.host_ = host;
    this.port_ = port;
    this.timeout_ = timeout;
    this.spawnProcesses_ = new SpawnProcess(this);
  }

  // https check
  public async httpsCheck(): Promise<HTTPSCheck> {
    // timeout, race this condition with httpsCheck
    const timeoutPromise: Promise<HTTPSCheck> = new Promise((resolve) =>
      setTimeout(() => resolve({} as HTTPSCheck), this.timeout_)
    );

    let httpsCheck = {} as HTTPSCheck;
    const httpsCheckPromise: Promise<HTTPSCheck> = new Promise(
      (resolve, reject) => {
        this.spawnProcesses_.httpsProcess_.stdout.on("data", (data) => {
          httpsCheck.status = String(data);

          // status 000, no response, curl over proxy
          if (data === "000") {
            httpsCheck.https = undefined;
          } else if (Array.from(data)[0] !== "2") {
            httpsCheck.https = false;
          } else {
            httpsCheck.https = true;
          }

          resolve(httpsCheck);
        });

        this.spawnProcesses_.httpsProcess_.stderr.on("data", (data) => {
          console.log(String(data));
        });

        // handle error, i dont want to reject because it stops program, expecting issues lol
        this.spawnProcesses_.httpsProcess_.on("error", (error) => {
          console.log(`https check: ${error}`);
          resolve(httpsCheck);
        });

        // handle exit
        this.spawnProcesses_.httpsProcess_.on("exit", (code) => {
          console.log(`httpsCheck exit code: ${code}`);
        });
      }
    );

    // race between timeout and httpsCheck
    try {
      return await Promise.race([timeoutPromise, httpsCheckPromise]);
    } catch (error) {
      console.log(`httpsCheck error in race: ${error}`);
      return {} as HTTPSCheck;
    }
  }

  // ping check
  public async pingCheck(): Promise<PingCheck> {
    // timeout, race this condition with httpsCheck
    const timeoutPromise: Promise<PingCheck> = new Promise((resolve) =>
      setTimeout(() => resolve({} as PingCheck), this.timeout_)
    );

    let json = {} as any;
    let pingObj = {} as PingCheck;
    let str: string = "";
    const pingCheckPromise: Promise<PingCheck> = new Promise(
      (resolve, reject) => {
        this.spawnProcesses_.pingProcess_.stdout.on("data", (data) => {
          console.log(String(data));
          str += data.toString();
          try {
            let arr = str.split(",");
            arr.forEach((data) => {
              let temp = data.split(":");
              json[String(temp[0].replace(/\s+/g, ""))] = temp[1].replace(
                /\s+/g,
                ""
              );
            });

            Object.assign(pingObj, json);
            resolve(pingObj);
          } catch (error) {
            console.log(`pingCheck error: ${error}`);
            resolve(undefined);
          }
        });

        this.spawnProcesses_.pingProcess_.stderr.on("data", (data) => {
          console.log(String(data));
        });

        this.spawnProcesses_.pingProcess_.on("exit", (code) => {
          console.log(`pingCheck cp exit code: ${code}`);
        });
      }
    );

    // race between timeout and httpsCheck
    try {
      return await Promise.race([timeoutPromise, pingCheckPromise]);
    } catch (error) {
      console.log(`httpsCheck error in race: ${error}`);
      return {} as HTTPSCheck;
    }
  }

  // proxy check
  public async proxyCheck() {
    let pCheck = {} as ProxyCheck;
    let pHeaders = {} as ProxyHeaders;
    let statusCheck: boolean = false;
    return new Promise(async (resolve, reject) => {
      // stream standard output (response from proxy judge here)
      this.spawnProcesses_.proxyProcess_.stdout.on("data", async (data) => {
        // statusCheck is calculated in the stderr block, looks at response header output
        if (!statusCheck) {
          console.log("status check error");
          resolve({} as ProxyCheck);
        }

        // Strip/analyze headers here
        try {
          pHeaders.res = JSON.parse(await data.toString());
          let publicIP: any = (await this.getPIP()) || {};
          let toFlag: any[] = [];
          Object.keys(pHeaders.res).forEach(async (key) => {
            if (key in ENUM_FlaggedHeaderValues) {
              if (publicIP !== undefined || publicIP !== ({} as any)) {
                if (String(pHeaders.res[key as keyof JSON]) === publicIP) {
                  pCheck.anonymity = ENUM_ProxyAnonymity.Transparent;
                } else {
                  pCheck.anonymity = ENUM_ProxyAnonymity.Anonymous;
                }
              } else {
                pCheck.anonymity = undefined;
              }
              toFlag.push(key);
            }
            pCheck.cause = toFlag;
            if (pCheck.cause.length === 0) {
              pCheck.anonymity = ENUM_ProxyAnonymity.Elite;
            }
          });

          resolve(pCheck);
        } catch (error) {
          console.log(`curlProxy error: ${error}`);
        }
      });

      // stream standard error, this is stream first anyway
      // // request/response headers are streamed here (curl -v flag)
      let lineCount: number = 0;
      let reqHeaders = {} as any;
      const rlStderr = readline.createInterface({
        input: this.spawnProcesses_.proxyProcess_.stderr,
      });
      for await (const line of rlStderr) {
        // console.log(line);
        lineCount++;

        // resolve undefined in the middle of the stream if connection request fails
        if (
          lineCount === 2 &&
          line.indexOf(`* Connected to ${this.host_}`) === -1
        ) {
          // kill readline
          rlStderr.close();
          rlStderr.removeAllListeners();
          console.log("connection error");
          resolve(undefined);
        }

        // sucessful response check, read before try parse json response
        if (line.indexOf(`< HTTP/1.1 200 OK`) !== -1) {
          statusCheck = true;
        }

        // ">" curl request headers display, "<" curl response header display
        // i removed
        if (line.indexOf(`< Via:`) !== -1) {
          pCheck.anonymity = ENUM_ProxyAnonymity.Anonymous;
        }

        // add to request headers
        if (line.indexOf(`> `) !== -1 && line.indexOf(`GET`) === -1) {
          let kv = line.slice(2).split(":");
          reqHeaders[`${kv[0]}`] = kv[1];
        }
      }
      try {
        pHeaders.req = JSON.parse(JSON.stringify(reqHeaders));
      } catch (error) {
        console.log("json parse error");
        pHeaders.req = reqHeaders;
      }
      pCheck.headers = pHeaders;
      rlStderr.close();
      rlStderr.removeAllListeners();

      // handle error
      this.spawnProcesses_.proxyProcess_.on("error", (error) => {
        console.log(`curl proxy error: ${error}`);
      });

      // handle spawn exit
      this.spawnProcesses_.proxyProcess_.on("exit", async (code) => {
        console.log(`proxyCheck cp exit: ${code}`);
        if (code === null) {
          console.log(`proxyCheck timeout`);
          resolve({} as ProxyCheck);
        }
        if (code !== 0) {
          reject(new Error(`proxyCheck cp error`));
        }
      });
    });
  }

  // google check
  public async checkGoogle() {
    try {
      let res = await fetch(
        `https://www.google.com/`,
        fetchConfig(this.host_, this.port_, this.timeout_)["config"]
      );
      clearTimeout(
        fetchConfig(this.host_, this.port_, this.timeout_)["timeoutId"]
      );
      if (res.status === 200) {
        return true;
      }
      return false;
    } catch (error) {
      console.log(`google error: ${error}`);
      return false;
    }
  }

  // location check
  public async getLocation() {
    try {
      let status = {} as ProxyLocation;
      let response = await fetch(
        `http://ip-api.com/json/`,
        fetchConfig(this.host_, this.port_, this.timeout_)["config"]
      );
      clearTimeout(
        fetchConfig(this.host_, this.port_, this.timeout_)["timeoutId"]
      );
      if (response.status !== 200) {
        console.log("getLocation status error");
        return undefined;
      }
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") === -1) {
        console.log("response is not json");
      }
      const isAnonymousCallBack = async (): Promise<boolean> => {
        return this.getPIP().then((publicip) => {
          if (String(data["query"]) !== publicip) {
            return true;
          }
          return false;
        });
      };
      let data: any = await response.json();
      if (
        this.host_ === String(data["query"]) ||
        (await isAnonymousCallBack())
      ) {
        // assignment is a bit redunant, todo: switch to interface and cast
        status.country = String(data["country"]);
        status.region = String(data["regionName"]);
        status.city = String(data["city"]);
        status.zip = String(data["zip"]);
        status.location = {
          lat: String(data["lat"]),
          long: String(data["lon"]),
        };
        status.tz = String(data["timezone"]);
        status.isp = String(data["isp"]);
        return status;
      }
      return status;
    } catch (error) {
      console.log(`getLocation error: ${error}`);
      return {} as ProxyLocation;
    }
  }

  public async getPIP() {
    const timeoutPromise = new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({});
      }, this.timeout_);
    });

    const publicIPPromise = new Promise((resolve, reject) => {
      http.get({ host: "api.ipify.org", port: 80, path: "/" }, function (resp) {
        resp.on("data", function (ip) {
          resolve(String(ip));
        });
      });
    });

    return Promise.race([publicIPPromise, timeoutPromise]);
  }

  public async check(): Promise<Checker> {
    let all = await Promise.all([
      this.httpsCheck(),
      this.pingCheck(),
      this.proxyCheck(),
      this.checkGoogle(),
      this.getLocation(),
    ]);

    let checker = {} as Checker;
    checker.httpsCheck = all[0];
    checker.pingCheck = all[1];
    checker.proxyCheck = all[2];
    checker.googleCheck = all[3];
    checker.location = all[4];

    this.spawnProcesses_.httpsProcess_.stdout.destroy();
    this.spawnProcesses_.httpsProcess_.stderr.destroy();
    this.spawnProcesses_.httpsProcess_.kill("SIGKILL");
    this.spawnProcesses_.pingProcess_.stdout.destroy();
    this.spawnProcesses_.pingProcess_.stderr.destroy();
    this.spawnProcesses_.pingProcess_.kill("SIGKILL");
    this.spawnProcesses_.proxyProcess_.stdout.destroy();
    this.spawnProcesses_.proxyProcess_.stderr.destroy();
    this.spawnProcesses_.proxyProcess_.kill("SIGKILL");
    
    return checker;
  }
}