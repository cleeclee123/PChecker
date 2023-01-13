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
  response: any;
  headers: JSON;
  anonymity: ENUM_ProxyAnonymity;
  https: HTTPSCheck;
  cause?: string[];
};

export type HTTPSCheck = {
  status: string,
  https: boolean | undefined;
}

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
  X_PROXY_ID = "X_PROXY_ID"
}

export const kUserAgents: string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0",
  "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9",
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36",
]

export enum ENUM_ProxyAnonymity {
  Transparent = "Transparent", 
  Anonymous = "Anonymous",
  Elite = "Elite"
}