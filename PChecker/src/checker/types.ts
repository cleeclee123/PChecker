import {
  ENUM_ProxyAnonymity,
  ENUM_ERRORS,
  ENUM_DNSLeakCheck,
} from "./emuns.js";

import http from "http";

// optional type if location data is available
export type ProxyLocation = {
  data: JSON;
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
  uptime: number;
};

// Recursive Type Aliases
export type TypeAliasesTemp =
  | string
  | number
  | boolean
  | { [x: string]: TypeAliasesTemp }
  | Array<TypeAliasesTemp>;

export type PingCheck = TypeAliasesTemp;

export type PublicIPRes = TypeAliasesTemp;

export type ProxyHeaders = {
  res: JSON;
  req: JSON;
};

export type ProxyOptions = {
  host: string;
  port: number;
  method: string;
  path: string;
  headers?: any;
  agent?: http.Agent;
};

export type ProxyError = {
  error: ENUM_ERRORS;
};

export type ProxyInfoFromHttp = {
  header: JSON;
  responseTime: number;
  anonymity: ENUM_ProxyAnonymity;
  cause: string[];
};

export type ProxyInfoFromHttps = {
  statusCode: number;
  response: any;
  responseTime: number;
};

export type ProxyContentCheck = {
  hasChanged: boolean;
  hasUnwantedContent?: boolean;
  hasAds?: boolean;
  hasScripts?: boolean;
  hasIframes?: boolean;
  hasExecution?: boolean;
  hasEncodedContent?: boolean;
  hasEventHandler?: boolean;
  hasFunctions?: boolean;
  hasRedirect?: boolean;
  hasTracker?: boolean;
  hasMiner?: boolean;
};

export type ProxyDNSCheck = {
  bashWSDomains: string[];
  currentServer: string;
  dnsServerCount: number;
  dnsServers: DNSResponseServer[];
  conclusion: ENUM_DNSLeakCheck;
};

export type DNSResponseServer = {
  ip: string;
  country: string;
  country_name: string;
  asn: string;
  type: string;
};

export type ProxyInfoEssential = {
  judgeServerRes?: number;
  anonymity?: ENUM_ProxyAnonymity | "";
  https?: boolean;
  httpConnectRes?: number;
  countryCode?: string;
  errors?: string[];
  proxyString?: string;
};

export type PCheckerOptions = {
  host?: string;
  port?: string;
  timeout?: string;
  publicIPAddress?: string;
  username?: string;
  password?: string;
};
