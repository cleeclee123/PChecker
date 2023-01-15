import fetch from "node-fetch";
import * as readline from "readline";
import {
  ProxyCheck,
  ProxyHeaders,
  HTTPSCheck,
  ProxyPing,
  ProxyPerformance,
  ProxyLocation,
  ENUM_ProxyAnonymity,
  ENUM_FlaggedHeaderValues,
  fetchConfig,
  curlPingConfig,
  PublicIPRes,
} from "./constants.js";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as dotenv from "dotenv";
dotenv.config();

// deployed this php script https://github.com/cleeclee123/azenv to apache server
const kProxyJudgeURL = `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`;

/**
 * tests if proxies work by checking connection through google
 * @param proxy: host, port
 * @returns if proxy works with google
 */
export const testGoogle = async (
  host: string,
  port: string
): Promise<boolean> => {
  try {
    let res = await fetch(
      `https://www.google.com/`,
      fetchConfig(host, port, 1000)["config"]
    );
    clearTimeout(fetchConfig(host, port, 1000)["timeoutId"]);
    if (res.status === 200) {
      return true;
    }
    return false;
  } catch (error) {
    console.log(`google error: ${error}`);
    return false;
  }
};

/**
 * to check if proxy allows https, send a http connect request to proxy through curl
 * timeout: curl has a built in timeout but i will timeout and kill the child process and resolve undefined
 * @param host
 * @param port
 * @param timeout, in ms
 * @returns boolean if https is allowed by proxy, undefined
 */
export const httpsCheck = async (
  host: string,
  port: string,
  timeout: number
): Promise<HTTPSCheck> => {
  // curl command to get the status code of a http connect request to a host/port
  const curlTunnelStatus: ChildProcessWithoutNullStreams =
    spawn("curl", [
      "-s",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}",
      "-p",
      "-x",
      `http://${host}:${port}`,
      `${kProxyJudgeURL}`,
    ]) || ({} as ChildProcessWithoutNullStreams);

  // timeout, race this condition with httpsCheck
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({} as HTTPSCheck), timeout)
  );

  // promise will resolve right away after streaming status code
  let httpsCheck = {} as HTTPSCheck;
  const httpsCheckPromise: Promise<HTTPSCheck> = new Promise(
    (resolve, reject) => {
      curlTunnelStatus.stdout.on("data", (data) => {
        httpsCheck.status = String(data);
        // status 000, no response, curl proxy proxy
        if (String(data) === "000") {
          httpsCheck.https = undefined;
        } else if (Number(data) !== 200) {
          httpsCheck.https = false;
        } else {
          httpsCheck.https = true;
        }
        curlTunnelStatus.stdout.destroy();
        curlTunnelStatus.stderr.destroy();
        curlTunnelStatus.kill("SIGKILL");
        resolve(httpsCheck);
      });

      // handle error, i dont want to reject because it stops program, expecting issues lol
      curlTunnelStatus.on("error", (error) => {
        console.log(`https check: ${error}`);
        resolve(httpsCheck);
      });

      // handle exit
      curlTunnelStatus.on("exit", (code) => {
        console.log(`httpsCheck exit code: ${code}`);
      });
    }
  );

  // user defined type guard to check HTTPSCheck type
  function isHTTPSCheck(arg: any): arg is HTTPSCheck {
    return arg.status !== undefined;
  }

  // race between timeout and httpsCheck
  try {
    const results = await Promise.race([timeoutPromise, httpsCheckPromise]);
    if (isHTTPSCheck(results)) {
      return results;
    }
    console.log("timeouted");
    return undefined;
  } catch (error) {
    console.log(`httpsCheck error in race: ${error}`);
    return {} as HTTPSCheck;
  }
};

// measure the request, response, and total time with curl by spawn child process
// reference: https://blog.josephscott.org/2011/10/14/timing-details-with-curl/
export const pingCheck = (
  host: string,
  port: string,
  timeout: number
): Promise<ProxyPing | undefined> => {
  // returns time to connect in seconds
  const ping: ChildProcessWithoutNullStreams =
    spawn(
      "curl",
      [
        "-s",
        "-o",
        "/dev/null",
        "-w",
        curlPingConfig,
        "--proxy",
        `http://${host}:${port}`,
        `${kProxyJudgeURL}`,
      ],
      { timeout: timeout }
    ) || ({} as ChildProcessWithoutNullStreams);

  let json = {} as any;
  let pingObj = {} as ProxyPing;
  let str: string = "";
  return new Promise((resolve, reject) => {
    ping.stdout.on("data", (data) => {
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
        ping.stdout.destroy();
        ping.stderr.destroy();
        ping.kill("SIGKILL");

        Object.assign(pingObj, json);
        resolve(pingObj);
      } catch (error) {
        console.log(`pingCheck error: ${error}`);
        resolve(undefined);
      }
    });
    ping.on("exit", (code) => {
      console.log(`pingCheck cp exit code: ${code}`);
    });
  });
};

/**
 * look at response from headers to find the anonymity of proxy
 * @param host
 * @param port
 * @returns type ProxyCheck, information about the health of the proxy
 */
export const proxyCheck = (
  host: string,
  port: string,
  timeout: number
): Promise<ProxyCheck | undefined> => {
  // "-i" flag outputs request, "-H" flag will remove header value: trying to make it look like a real request
  const curlProxy: ChildProcessWithoutNullStreams =
    spawn(
      "curl",
      [
        "-s",
        `-H`,
        `Proxy-Connection:`,
        "--proxy",
        `http://${host}:${port}`,
        `${kProxyJudgeURL}`,
        `-v`,
      ],
      { timeout: timeout }
    ) || ({} as ChildProcessWithoutNullStreams);

  let pCheck = {} as ProxyCheck;
  let pHeaders = {} as ProxyHeaders;
  let statusCheck: boolean = false;
  return new Promise(async (resolve, reject) => {
    // stream standard output (response from proxy judge here)
    curlProxy.stdout.on("data", async (data) => {
      // statusCheck is calculated in the stderr block, looks at response header output
      if (!statusCheck) {
        console.log("status check here");
        resolve(undefined);
      }
      try {
        pHeaders.res = JSON.parse(await data.toString());
        let publicIP: any = (await getMyPublicIP(timeout)) || {};
        let toFlag: any[] = [];
        Object.keys(pHeaders.res).forEach(async (key) => {
          if (key in ENUM_FlaggedHeaderValues) {
            if (publicIP !== undefined || publicIP !== ({} as any)) {
              if (
                String(pHeaders.res[key as keyof JSON]) ===
                String(publicIP["ip"])
              ) {
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
        let pAll = await Promise.all([
          httpsCheck(host, port, timeout) || ({} as HTTPSCheck),
          testGoogle(host, port),
          pingCheck(host, port, timeout) || ({} as ProxyPing),
          getLocation(host, port, timeout) || ({} as ProxyLocation),
        ]);
        pCheck.https = pAll[0];
        pCheck.google = pAll[1];
        pCheck.ping = pAll[2];
        pCheck.location = pAll[3];

        // delete pCheck.response["URI"];
        curlProxy.stdout.destroy();
        curlProxy.stderr.destroy();
        curlProxy.kill("SIGKILL");

        resolve(pCheck);
      } catch (error) {
        console.log(`curlProxy error: ${error}`);
      }
      // console.log(data.toString());
    });

    // stream standard error, this is stream first anyway
    // // request/response headers are streamed here (curl -v flag)
    let lineCount: number = 0;
    let reqHeaders = {} as any;
    let resHeaders = {} as any;
    const rlStderr = readline.createInterface({ input: curlProxy.stderr });
    for await (const line of rlStderr) {
      // console.log(line);
      lineCount++;

      // resolve undefined in the middle of the stream if connection request fails
      if (lineCount === 2 && line.indexOf(`* Connected to ${host}`) === -1) {
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
    curlProxy.on("error", (error) => {
      curlProxy.kill("SIGKILL");
      console.log(`curl proxy error: ${error}`);
    });

    // handle spawn exit
    curlProxy.on("exit", async (code) => {
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
};

// helper function to get my public ip address
export async function getMyPublicIP(timeout: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let publicIP = {} as PublicIPRes;
  try {
    const res = await fetch("https://api.ipify.org/?format=json", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    Object.assign(publicIP, await res.json());
    return publicIP;
  } catch (error) {
    console.log(`getMyPublicIP error: ${error}`);
    return {} as PublicIPRes;
  }
}

// helper function to get location data of ip address from api
export async function getLocation(
  host: string,
  port: string,
  timeout: number
): Promise<ProxyLocation | undefined> {
  try {
    let status = {} as ProxyLocation;
    let response = await fetch(
      `http://ip-api.com/json/`,
      fetchConfig(host, port, timeout)["config"]
    );
    clearTimeout(fetchConfig(host, port, 1000)["timeoutId"]);
    if (response.status !== 200) {
      console.log("getLocation status error");
      return undefined;
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") === -1) {
      console.log("response is not json");
    }
    const isAnonymousCallBack = async (): Promise<boolean> => {
      return getMyPublicIP(timeout).then((publicip) => {
        if (String(data["query"]) !== publicip) {
          return true;
        }
        return false;
      });
    };
    let data: any = await response.json();
    if (host === String(data["query"]) || (await isAnonymousCallBack())) {
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
