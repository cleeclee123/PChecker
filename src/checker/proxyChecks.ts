import fetch from "node-fetch"
import { headersValuesToFlag, fetchConfig, ProxyCheck } from "./types.js";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as dotenv from "dotenv";
dotenv.config();

const controller = new AbortController();

/**
 * tests if proxies work by checking connection through google
 * @param proxy: host, port
 * @returns if proxy works with google
 */
export const testGoogle = async (
  host: string,
  port: string
): Promise<boolean> => {
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  let configWithTO = { ...fetchConfig(host, port), signal: controller.signal };
  try {
    let res = await fetch(`https://www.google.com/`, configWithTO);
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
 * @param host
 * @param port
 * @param timeout
 * @returns boolean if https is allowed by proxy
 */
export const httpsCheck = async (
  host: string,
  port: string,
  timeout: number
): Promise<boolean> => {
  const curlTunnelStatus: ChildProcessWithoutNullStreams = spawn("curl", [
    "--max-time",
    `${timeout}`,
    "-s",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    "-p",
    "-x",
    `http://${host}:${port}`,
    `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`,
  ]);

  let httpsAllowed = false;
  return new Promise((resolve, reject) => {
    curlTunnelStatus.stdout.setEncoding("utf8");
    curlTunnelStatus.stdout.on("data", async (data) => {
      console.log("status code", data);
      // No valid HTTP response code check over proxy
      if (String(data) === "000") {
        curlTunnelStatus.kill("SIGKILL");
        httpsAllowed = false;
      } else if (Number(data) !== 200) {
        console.log(`status error ${data}`);
        curlTunnelStatus.kill("SIGKILL");
        httpsAllowed = false;
      } else {
        httpsAllowed = true;
      }
      resolve(httpsAllowed);
    });
  });
};

/**
 * look at headers to find the anonymity of passed in proxy
 * header values to flag:
 *  - HTTP_X_FORWARD_FOR
 *  - HTTP_VIA
 *  - HTTP_AUTH
 *  - HTTP_FROM
 *  - REMOTE_ADDR
 *  - PROXY_CONNECTION
 *  - Proxy-Authorization
 *  -
 * @param host
 * @param port
 * @returns type ProxyCheck, information about the health of the proxy
 */
export const proxyChecks = (
  host: string,
  port: string,
  timeout: number
): Promise<ProxyCheck> => {
  const curlProxyStatus: ChildProcessWithoutNullStreams = spawn("curl", [
    "--max-time",
    `${timeout}`,
    "-s",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    "--proxy",
    `http://${host}:${port}`,
    `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`,
  ]);
  const curlProxy: ChildProcessWithoutNullStreams = spawn("curl", [
    "--max-time",
    `${timeout}`,
    "--proxy",
    `http://${host}:${port}`,
    `http://myproxyjudgeclee.software/${process.env.PJ_KEY}`,
    "-i",
  ]);
  let pCheck = {} as ProxyCheck;
  return new Promise((resolve, reject) => {
    curlProxyStatus.stdout.on("data", async (data) => {
      if (Number(data) !== 200 && String(data) !== "000") {
        console.log(`status error ${data}`);
        curlProxy.kill("SIGKILL");
        curlProxyStatus.kill("SIGKILL");
        resolve(pCheck);
      }
    });
    // stream standard output
    let response = "";
    let header = {} as any;
    curlProxy.stdout.on("data", async (data) => {
      response += data;
    });

    // handle error
    curlProxy.on("error", (error) => {
      curlProxy.kill("SIGKILL");
      console.log(`curl proxy error: ${error}`);
    });

    // handle spawn exit
    curlProxy.on("exit", async (code) => {
      if (code === 28) {
        console.log("timeout error");
        resolve(pCheck);
      }
      let headerParts = response
        .substring(0, response.indexOf("{"))
        .split("\r\n");
      headerParts.forEach((data) => {
        if (data !== undefined) {
          if (!data.includes(":")) {
            header["status"] += data + " ";
          } else {
            let parts = data.split(":");
            header[parts[0]] = parts[1];
          }
        }
      });
      try {
        if (response.slice(response.indexOf("{"))) {
          pCheck.response = JSON.parse(response.slice(response.indexOf("{")));
        } else {
          pCheck.response = response.slice(response.indexOf("{"));
        }
        pCheck.isElite = !headersValuesToFlag.some((v: any) => response.includes(v));
        // no needs to enter loop if proxy is elite
        if (!pCheck.isElite) {
          let causeTemp: string[] = [];
          headersValuesToFlag.forEach((ss: any) => {
            if (response.includes(ss)) {
              causeTemp.push(ss);
            }
          });
          pCheck.cause = causeTemp;
        } else {
          pCheck.cause = [];
        }
        header["status"] = String(header["status"]).substring(9);
        pCheck.headers = header;
        pCheck.https = await httpsCheck(host, port, timeout);
        pCheck.googleTest = await testGoogle(host, port);
        resolve(pCheck);
      } catch {
        pCheck.response = "failed";
        resolve(pCheck);
      }
    });
  });
};
