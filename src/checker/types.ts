import HttpsProxyAgent from "https-proxy-agent";

export type IPInfo = {
  firstOctet: number;
  subnet: number;
  ipaddress: string;
  class: string;
};

export type ProxyParts = {
  protocol: string;
  host: string;
  port: string;
  proxyCheck: ProxyCheck;
};

export type ProxiesInfo = {
  ipInfo: IPInfo;
  proxies: Array<ProxyParts>;
};

export type ProtocolPort = {
  protocol: string;
  port: number;
};

export type ProxyStatus = {
  hidesIP: boolean;
  anonymity: string;
  status: boolean;
  country?: string;
  region?: string;
  city?: string;
  zip?: string;
  location?: Object;
  tz?: string;
  isp?: string;
};

export type ProxyCheck = {
  https: boolean;
  isElite: boolean;
  response: any;
  headers: any;
  cause: string[];
  googleTest: boolean;
};

export const kHttpPorts: Array<ProtocolPort> = [
  { protocol: "http(s)", port: 80 },
  { protocol: "http(s)", port: 83 },
  { protocol: "http(s)", port: 443 },
  { protocol: "http(s)", port: 999 },
  { protocol: "http(s)", port: 1010 },
  { protocol: "http(s)", port: 3127 },
  { protocol: "http(s)", port: 3128 },
  { protocol: "http(s)", port: 5239 },
  { protocol: "http(s)", port: 5678 },
  { protocol: "http(s)", port: 6379 },
  { protocol: "http(s)", port: 6969 },
  { protocol: "http(s)", port: 7121 },
  { protocol: "http(s)", port: 7777 },
  { protocol: "http(s)", port: 7890 },
  { protocol: "http(s)", port: 8000 },
  { protocol: "http(s)", port: 8001 },
  { protocol: "http(s)", port: 8008 },
  { protocol: "http(s)", port: 8080 },
  { protocol: "http(s)", port: 8081 },
  { protocol: "http(s)", port: 8088 },
  { protocol: "http(s)", port: 8085 },
  { protocol: "http(s)", port: 8090 },
  { protocol: "http(s)", port: 8118 },
  { protocol: "http(s)", port: 8123 },
  { protocol: "http(s)", port: 8888 },
  { protocol: "http(s)", port: 8999 },
  { protocol: "http(s)", port: 9030 },
  { protocol: "http(s)", port: 9090 },
  { protocol: "http(s)", port: 10001 },
  { protocol: "http(s)", port: 10004 },
  { protocol: "http(s)", port: 10006 },
  { protocol: "http(s)", port: 18379 },
  { protocol: "http(s)", port: 20000 },
  { protocol: "http(s)", port: 21345 },
  { protocol: "http(s)", port: 39409 },
  { protocol: "http(s)", port: 39811 },
  { protocol: "http(s)", port: 41890 },
  { protocol: "http(s)", port: 42069 },
  { protocol: "http(s)", port: 42194 },
  { protocol: "http(s)", port: 65238 },
];

export const uas: Array<string> = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0",
  "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9",
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36",
];

// helper funtion to create request header and https prpxy agent for fetch
export const fetchConfig = (host: string, port: string) => {
  return {
    headers: {
      "User-Agent": uas[Math.floor(Math.random() * uas.length)],
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
  };
};

export const headersValuesToFlag = [
  "X_FORWARDED_FOR",
  "VIA",
  "AUTHENTICATION",
  "Proxy-Connection",
  "PROXY_CONNECTION",
  "FROM",
  "REMOTE_ADDR",
  "Proxy-Authorization",
  'PROXY_AUTHORIZATION'
];