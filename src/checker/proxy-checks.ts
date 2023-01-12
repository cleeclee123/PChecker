import fetch from "node-fetch";
import HttpsProxyAgent from "https-proxy-agent";
import { ProxyCheck, HTTPSCheck } from "./types.js";
import { UserAgents, FlaggedHeaderValues } from "./emuns.js";
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
        "User-Agent": UserAgents[Math.floor(Math.random() * UserAgents.length)],
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
 * @param timeout
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

  // promise will resolve right away after streaming status code
  let httpsCheck = {} as HTTPSCheck;
  let httpsAllowed: boolean | undefined = false;
  return new Promise((resolve, reject) => {
    curlTunnelStatus.stdout.on("data", async (data) => {
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
  });
};

/**
 * look at response from headers to find the anonymity of proxy
 * @param host
 * @param port
 * @returns type ProxyCheck, information about the health of the proxy
 */
// export const proxyCheck = (
//   host: string,
//   port: string,
//   timeout: number
// ): Promise<ProxyCheck> => {
//   const curlProxyStatus: ChildProcessWithoutNullStreams = spawn("curl", [
//     "--max-time",
//     `${timeout}`,
//     "-s",
//     "-o",
//     "/dev/null",
//     "-w",
//     "%{http_code}",
//     "--proxy",
//     `http://${host}:${port}`,
//     `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`,
//   ]);
//   const curlProxy: ChildProcessWithoutNullStreams = spawn("curl", [
//     "--max-time",
//     `${timeout}`,
//     "--proxy",
//     `http://${host}:${port}`,
//     `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`,
//     "-i",
//   ]);
//   let pCheck = {} as ProxyCheck;
//   return new Promise((resolve, reject) => {
//     curlProxyStatus.stdout.on("data", async (data) => {
//       if (Number(data) !== 200 && String(data) !== "000") {
//         console.log(`status error ${data}`);
//         curlProxy.kill("SIGKILL");
//         curlProxyStatus.kill("SIGKILL");
//         resolve(pCheck);
//       }
//     });
//     // stream standard output
//     let response = "";
//     let header = {} as any;
//     curlProxy.stdout.on("data", async (data) => {
//       response += data;
//     });

//     // handle error
//     curlProxy.on("error", (error) => {
//       curlProxy.kill("SIGKILL");
//       console.log(`curl proxy error: ${error}`);
//     });

//     // handle spawn exit
//     curlProxy.on("exit", async (code) => {
//       if (code === 28) {
//         console.log("timeout error");
//         resolve(pCheck);
//       }
//       let headerParts = response
//         .substring(0, response.indexOf("{"))
//         .split("\r\n");
//       headerParts.forEach((data) => {
//         if (data !== undefined) {
//           if (!data.includes(":")) {
//             header["status"] += data + " ";
//           } else {
//             let parts = data.split(":");
//             header[parts[0]] = parts[1];
//           }
//         }
//       });
//       try {
//         if (response.slice(response.indexOf("{"))) {
//           pCheck.response = JSON.parse(response.slice(response.indexOf("{")));
//         } else {
//           pCheck.response = response.slice(response.indexOf("{"));
//         }
//         pCheck.isElite = !headersValuesToFlag.some((v: any) =>
//           response.includes(v)
//         );
//         // no needs to enter loop if proxy is elite
//         if (!pCheck.isElite) {
//           let causeTemp: string[] = [];
//           headersValuesToFlag.forEach((ss: any) => {
//             if (response.includes(ss)) {
//               causeTemp.push(ss);
//             }
//           });
//           pCheck.cause = causeTemp;
//         } else {
//           pCheck.cause = [];
//         }
//         header["status"] = String(header["status"]).substring(9);
//         pCheck.headers = header;
//         pCheck.https = await httpsCheck(host, port, timeout);
//         pCheck.googleTest = await testGoogle(host, port);
//         resolve(pCheck);
//       } catch {
//         pCheck.response = "failed";
//         resolve(pCheck);
//       }
//     });
//   });
// };
