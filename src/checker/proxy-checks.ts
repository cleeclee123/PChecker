import fetch from "node-fetch";
import HttpsProxyAgent from "https-proxy-agent";
import * as readline from "readline";
import {
  ProxyCheck,
  HTTPSCheck,
  kUserAgents,
  ENUM_ProxyAnonymity,
  ENUM_FlaggedHeaderValues,
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
  // 5 second timeout to fetch response
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1000);

  // helper funtion to create request header and https prpxy agent for fetch
  const fetchConfig = () => {
    return {
      // headers inspired from https://oxylabs.io/blog/5-key-http-headers-for-web-scraping
      headers: {
        "User-Agent":
          kUserAgents[Math.floor(Math.random() * kUserAgents.length)],
        Accept: "text/html",
        "Accept-Language": "en-US",
        "Accept-Encoding": "gzip, deflate",
        Connection: "Keep-Alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=259200",
        Referer: "http://www.google.com/",
      },
      agent: new HttpsProxyAgent.HttpsProxyAgent({
        host: host,
        port: Number(port),
      }),
      signal: controller.signal,
    };
  };
  try {
    let res = await fetch(`https://www.google.com/`, fetchConfig());
    clearTimeout(timeoutId);
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
): Promise<HTTPSCheck | string> => {
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
    setTimeout(() => resolve("timeout"), timeout)
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
        console.log(`https check exited with code: ${code}`);
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
    return "timeout";
  } catch (error) {
    console.log(`httpsCheck error in race: ${error}`);
    return {} as HTTPSCheck;
  }
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
  const curlProxy: ChildProcessWithoutNullStreams = spawn("curl", [
    "-s",
    `-H`,
    `Proxy-Connection:`,
    "--proxy",
    `http://${host}:${port}`,
    `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`,
    `-v`,
  ]);

  let pCheck = {} as ProxyCheck;
  let statusCheck: boolean = false;
  return new Promise(async (resolve, reject) => {
    // stream standard output (response from proxy judge here)
    curlProxy.stdout.on("data", async (data) => {
      // statusCheck is calculated in the stderr block, looks at response header output
      if (!statusCheck) {
        resolve(undefined);
      }
      try {
        pCheck.response = JSON.parse(await data.toString());
        let publicIP: any = (await getMyPublicIP()) || {};
        let toFlag: any[] = [];
        Object.keys(pCheck.response).forEach(async (key) => {
          if (key in ENUM_FlaggedHeaderValues) {
            if (publicIP !== undefined || publicIP !== ({} as any)) {
              if (String(pCheck.response[key]) === String(publicIP["ip"])) {
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
        });

        resolve(pCheck);
      } catch (error) {
        console.log(`curlProxy error: ${error}`);
      }
      // console.log(data.toString());
    });

    // stream standard error, this is stream first anyway
    // // request/response headers are streamed here (curl -v flag)
    let lineCount: number = 0;
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
    }
    rlStderr.close();
    rlStderr.removeAllListeners();

    // handle error
    curlProxy.on("error", (error) => {
      curlProxy.kill("SIGKILL");
      console.log(`curl proxy error: ${error}`);
    });

    // handle spawn exit
    curlProxy.on("exit", async (code) => {
      console.log(`exited with code: ${code}`);
      if (code !== 0) {
        reject(new Error(`proxyCheck cp error`));
      }
    });
  });
};

// helper function to get my public ip address
export async function getMyPublicIP() {
  try {
    const res = await fetch("https://api.ipify.org/?format=json");
    return await res.json();
  } catch (error) {
    console.log(`getMyPublicIP error: ${error}`);
    return undefined;
  }
}
