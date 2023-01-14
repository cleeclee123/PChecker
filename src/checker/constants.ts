import HttpsProxyAgent from "https-proxy-agent";

/*  TYPES  */

// main type return in pChecker
export type ProxyCheck = {
  proxyString: string;
  response: any;
  headers: any;
  anonymity: ENUM_ProxyAnonymity;
  type: string[];
  cause?: string[];
  https: HTTPSCheck; // todo: implement to proxyCheck
  google: boolean; // todo: implement to proxyCheck
  ping: ProxyPing; // todo: create function
  location?: ProxyLocation; // todo: create function
  performance?: ProxyPerformance; // todo: create function
};

// optional type if location data is available
export type ProxyLocation = {
  country: string;
  region: string;
  city: string;
  zip: string;
  location: Object;
  tz: string;
  isp: string;
};

// type to check track of https status
// planned on this being an optional type in type ProxyCheck
// will just return if status === 200 or undefined if status === 000
export type HTTPSCheck = {
  status: string;
  https: boolean | undefined;
};

// values from database, put in middleware?
export type ProxyPerformance = {
  checkCount: number;
  successCount: number;
  Uptime: number;
};

// reference: https://blog.josephscott.org/2011/10/14/timing-details-with-curl/
export type ProxyPing = {
  time_namelookup: number;
  time_connect: number;
  time_appconnect: number;
  time_pretransfer: number;
  time_redirect: number;
  time_starttransfer: number;
  time_total: number;
};

export type ProxyHeaders = {
  res: any;
  req: any;
};

/* ENUMS */

export enum ENUM_FlaggedHeaderValues {
  AUTHENTICATION = "AUTHENTICATION",
  CLIENT_IP = "CLIENT_IP",
  FROM = "FROM",
  FORWARDED_FOR = "FORWARDED_FOR",
  FORWARDED = "FORWARDED",
  PROXY_AUTHORIZATION = "PROXY_AUTHORIZATION",
  PROXY_CONNECTION = "PROXY_CONNECTION",
  REMOTE_ADDR = "REMOTE_ADDR",
  VIA = "VIA",
  X_CLUSTER_CLIENT_IP = "X_CLUSTER_CLIENT_IP",
  X_FORWARDED_FOR = "X_FORWARDED_FOR",
  X_FORWARDED = "X_FORWARDED",
  X_PROXY_ID = "X_PROXY_ID",
}

export enum ENUM_ProxyAnonymity {
  Transparent = "Transparent",
  Anonymous = "Anonymous",
  Elite = "Elite",
}

/* CONSTANTS */

export const kUserAgents: string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0",
  "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9",
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36",
];

// helper funtion to create request header and https prpxy agent for fetch
export const fetchConfig = (host: string, port: string, timeout: number) => {
  // 5 second timeout to fetch response
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return {
    // headers inspired from https://oxylabs.io/blog/5-key-http-headers-for-web-scraping
    config: {
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
    },
    timeoutId: timeoutId,
  };
};