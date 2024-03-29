export enum FlaggedHeaderValuesEnum {
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
  X_FORWARDED_PROTO = "X_FORWARDED_PROTO",
  X_FORWARDED = "X_FORWARDED",
  X_FORWARDED_HOST = "X_FORWARDED_HOST",
  X_PROXY_ID = "X_PROXY_ID",
  X_FRAME_OPTIONS = "X_FRAME_OPTIONS",
  X_CONTENT_TYPE_OPTION = "X_CONTENT_TYPE_OPTION",
  X_DNS_PREFETCH_CONTROL_CONTROL = "X_DNS_PREFETCH_CONTROL_CONTROL",
  X_XSS_PROTECTION = "X_XSS_PROTECTION",
  SET_COOKIES = "SET_COOKIES",
}

export enum ProxyAnonymityEnum {
  Transparent = "Transparent",
  Anonymous = "Anonymous",
  Elite = "Elite",
  Unknown = "Unknown"
}

export enum ErrorsEnum {
  CONNECTION_ERROR = "CONNECTION_ERROR",
  STATUS_CODE_ERROR = "NON_200_STATUS_CODE",
  JSON_PARSE_ERROR = "JSON_PARSE_ERROR",
  PARSE_ERROR = "PARSE_ERROR",
  PROMISE_RACE_ERROR = "PROMISE_RACE_ERROR",
  SOCKET_ERROR = "SOCKET_ERROR",
  SOCKET_RESPONSE_ERROR = "SOCKET_RESPONSE_ERROR",
  SOCKET_REQUEST_ERROR = "SOCKET_REQUEST_ERROR",
  EMPTY_SOCKET_RESPONSE = "EMPTY_RESPONSE",
  GEO_LOCATION_ERROR = "GEO_LOCATION_ERROR",
  PUBLIC_IP_ADDRESS_ERROR = "PUBLIC_IP_ADDRESS_ERROR",
  NO_DNS_SERVERS = "NO_DNS_SERVERS",
  SOCKET_HANG_UP = "SOCKET_HANG_UP",
  PROXY_JUDGE_ERROR = "PROXY_JUDGE_ERROR",
  PROXY_JUDGE_TIMEOUT = "PROXY_JUDGE_TIMEOUT",
  PROXY_JUDGE_EMPTY_RESPONSE = "PROXY_JUDGE_EMPTY_RESPONSE",
  TIMEOUT = "TIMEOUT",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  EMPTY_RESPONSE = "EMPTY_RESPONSE",
  BAD_CONTENT = "BAD_CONTENT",
  BAD_RESPONSE = "BAD_RESPONSE",
  BAD_URL_FORMAT = "BAD_URL_FORMAT",
  CHILD_PROCESS_ERROR = "CHILD_PROCESS_ERROR",
  DNS_LEAK_SCRIPT_ERROR = "DNS_LEAK_SCRIPT_ERROR",
}

export enum PCheckerErrors {
  getPublicIPError = "getPublicIPError",
  checkAnonymityError = "checkAnonymityError",
  checkHTTPSError = "checkHTTPSError",
  siteCheckError = "checkSiteError",
  getProxyLocationError = "getProxyLocationError"
}

export const customEnumError = (customMessage: string, error: ErrorsEnum) => {
  return `${customMessage}_${error}`;
};

export enum DNSLeakEnum {
  NoDNSLeak = 0,
  PossibleDNSLeak = 1,
}
