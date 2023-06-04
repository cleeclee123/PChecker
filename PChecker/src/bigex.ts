// import * as PChecker from "./checker/PChecker.js";
// import { PCheckerOptions, ProxyInfoEssential } from "./checker/types.js";
// import { MyConcurrentPromiseQueue } from "./checker/pqueue.js";
import http from "http";
import fetch from "node-fetch";
import os from "os";
import url from "url";

os.freemem();

console.time();

const httpReqCleanup = (reqObj: http.ClientRequest) => {
  reqObj.on("error", (error) => {
    console.log("http error");
    console.log(error);
    reqObj.destroy();
  });

  reqObj.on("close", () => {
    console.log("http closed");
  });

  reqObj.end();

  return reqObj;
};

enum SingleProxyAPIPath {
  singleproxiesGH = "/singleproxiesGH",
  singleproxiesDS = "/singleproxiesDS",
}

async function fetchProxiesSINGLE(path: SingleProxyAPIPath) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      host: "127.0.0.1",
      port: 8080,
      path: path,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
      },
    };

    const startTime = new Date().getTime();
    const httpReqObj = http.get(requestOptions, (res) => {
      if (res.statusCode !== 200) {
        console.log(`bad status code: ${res.statusCode}`);
        res.destroy();
      }

      res.on("data", async (data) => {
        try {
          // [host, port]
          let proxy: string[] = JSON.parse(data.toString());

          let params = {
            host: proxy[0],
            port: proxy[1],
            to: "5000",
          } as any;

          let query = Object.keys(params)
            .map(
              (k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k])
            )
            .join("&");

          let url = `http://127.0.0.1:6969/checkessential?${query}`;
          console.log(url);

          await fetch(url);
        } catch (error: any) {
          console.log(error);
        }
      });

      res.on("end", () => {
        console.log("res end");
      });

      res.on("error", (error) => {
        console.log("res error");
        console.log(error);
        res.destroy();
      });

      res.on("close", () => {
        const endtime = new Date().getTime() - startTime;
        console.log(`res close: ${endtime}`);

        resolve({} as any);
      });
    });

    httpReqCleanup(httpReqObj);
  });
}

enum ListProxyAPIPath {
  proxiesGH = "/proxiesGH",
  proxiesDS = "/proxiesDS",
}

async function fetchProxiesLIST(path: ListProxyAPIPath) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      host: "127.0.0.1",
      port: 8080,
      path: path,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
      },
    };

    let count = 0;

    const startTime = new Date().getTime();
    const httpReqObj = http.get(requestOptions, (res) => {
      if (res.statusCode !== 200) {
        console.log(`bad status code: ${res.statusCode}`);
        res.destroy();
      }

      res.on("data", async (data) => {
        try {
          // [ [host, port] ]
          let proxy: string[][] = JSON.parse(data.toString());

          for (let i = 0; i < proxy.length; i++) {
            let params = {
              host: proxy[i][0],
              port: proxy[i][1],
              to: "5000",
            } as any;

            let query = Object.keys(params)
              .map(
                (k) =>
                  encodeURIComponent(k) + "=" + encodeURIComponent(params[k])
              )
              .join("&");

            let url = `http://127.0.0.1:6969/checkessential?${query}`;
            console.log(url);

            fetch(url);
            count++;
          }
        } catch (error: any) {
          console.log(error);
        }
      });

      res.on("end", () => {
        console.log("res end");
      });

      res.on("error", (error) => {
        console.log("res error");
        console.log(error);
        res.destroy();
      });

      res.on("close", () => {
        const endtime = new Date().getTime() - startTime;
        console.log(`res close: ${endtime} ms`);

        resolve(count);
      });
    });

    httpReqCleanup(httpReqObj);
  });
}

await fetchProxiesSINGLE(SingleProxyAPIPath.singleproxiesDS);
// console.log(await fetchProxiesLIST(ListProxyAPIPath.proxiesDS));

// mb used
let used = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(used);

console.timeEnd();

process.kill(process.pid);
