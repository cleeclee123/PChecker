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
  X_FORWARDED_PROTO = "X_FORWARDED_PROTO",
  X_FORWARDED = "X_FORWARDED",
  X_FORWARDED_HOST = "X_FORWARDED_HOST",
  X_PROXY_ID = "X_PROXY_ID",
  X_FRAME_OPTIONS = "X_FRAME_OPTIONS",
  X_CONTENT_TYPE_OPTION  = "X_CONTENT_TYPE_OPTION",
  X_DNS_PREFETCH_CONTROL_CONTROL = "X_DNS_PREFETCH_CONTROL_CONTROL",
  X_XSS_PROTECTION = "X_XSS_PROTECTION", 
  SET_COOKIES = "SET_COOKIES",
}

export enum ENUM_ProxyAnonymity {
  Transparent = "Transparent",
  Anonymous = "Anonymous",
  Elite = "Elite",
}

export enum ENUM_ERRORS {
  STATUS_CODE_ERROR = "STATUS_CODE_ERROR",
  CONNECTION_ERROR = "CONNECTION_ERROR",
  JSON_PARSE_ERROR = "JSON_PARSE_ERROR",
  PROMISE_RACE_ERROR = "PROMISE_RACE_ERROR",
  SOCKET_ERROR = "SOCKET_ERROR",
  EMPTY_SOCKET_RESPONSE = "EMPTY_RESPONSE",
  GEO_LOCATION_ERROR = "GEO_LOCATION_ERROR",
  PUBLIC_IP_ADDRESS_ERROR = "PUBLIC_IP_ADDRESS_ERROR",
  NO_DNS_SERVERS = "NO_DNS_SERVERS",
}

export const customEnumError = (customMessage: string, error: ENUM_ERRORS) => {
  return `${customMessage}_${error}`;
}

export enum ENUM_DNSLeakCheck {
  NoDNSLeak = 0,
  PossibleDNSLeak = 1,
}