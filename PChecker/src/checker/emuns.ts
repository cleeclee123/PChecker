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
  StatusCodeError = "Status Code Error",
  ConnectionError = "Connection Error",
  JSONParseError = "JSON Parse Error",
  PromiseRaceError = "PromiseRaceError",
  SocketError = "SocketError",
  EmptySocketResponse = "Empty Response",
  GeoLocationError = "GeoLocationError",
}

export enum ENUM_DNSLeakCheck {
  NoDNSLeak = 0,
  PossibleDNSLeak = 1,
}