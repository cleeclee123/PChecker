import { ENUM_ProxyAnonymity, ENUM_ERRORS } from "./emuns.js";

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