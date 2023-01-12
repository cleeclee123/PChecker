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

export type HTTPSCheck = {
  status: string,
  https: boolean | undefined;
}