import HttpsProxyAgent from "https-proxy-agent";
/// export interface 
// export interface SpawnProcess {
//   instance_: SpawnProcess;
//   httpsProcess_: ChildProcessWithoutNullStreams;
//   pingProcess_: ChildProcessWithoutNullStreams;
//   proxyProcess_: ChildProcessWithoutNullStreams;
//   superThis_: PChecker;
// }
/* ENUMS */
export var ENUM_FlaggedHeaderValues;
(function (ENUM_FlaggedHeaderValues) {
    ENUM_FlaggedHeaderValues["AUTHENTICATION"] = "AUTHENTICATION";
    ENUM_FlaggedHeaderValues["CLIENT_IP"] = "CLIENT_IP";
    ENUM_FlaggedHeaderValues["FROM"] = "FROM";
    ENUM_FlaggedHeaderValues["FORWARDED_FOR"] = "FORWARDED_FOR";
    ENUM_FlaggedHeaderValues["FORWARDED"] = "FORWARDED";
    ENUM_FlaggedHeaderValues["PROXY_AUTHORIZATION"] = "PROXY_AUTHORIZATION";
    ENUM_FlaggedHeaderValues["PROXY_CONNECTION"] = "PROXY_CONNECTION";
    ENUM_FlaggedHeaderValues["REMOTE_ADDR"] = "REMOTE_ADDR";
    ENUM_FlaggedHeaderValues["VIA"] = "VIA";
    ENUM_FlaggedHeaderValues["X_CLUSTER_CLIENT_IP"] = "X_CLUSTER_CLIENT_IP";
    ENUM_FlaggedHeaderValues["X_FORWARDED_FOR"] = "X_FORWARDED_FOR";
    ENUM_FlaggedHeaderValues["X_FORWARDED_PROTO"] = "X_FORWARDED_PROTO";
    ENUM_FlaggedHeaderValues["X_FORWARDED"] = "X_FORWARDED";
    ENUM_FlaggedHeaderValues["X_PROXY_ID"] = "X_PROXY_ID";
})(ENUM_FlaggedHeaderValues || (ENUM_FlaggedHeaderValues = {}));
export var ENUM_ProxyAnonymity;
(function (ENUM_ProxyAnonymity) {
    ENUM_ProxyAnonymity["Transparent"] = "Transparent";
    ENUM_ProxyAnonymity["Anonymous"] = "Anonymous";
    ENUM_ProxyAnonymity["Elite"] = "Elite";
})(ENUM_ProxyAnonymity || (ENUM_ProxyAnonymity = {}));
export var ENUM_ERRORS;
(function (ENUM_ERRORS) {
    ENUM_ERRORS["StatusCodeError"] = "Status Code Error";
    ENUM_ERRORS["ConnectionError"] = "Connection Error";
    ENUM_ERRORS["JSONParseError"] = "JSON Parse Error";
    ENUM_ERRORS["PromiseRaceError"] = "PromiseRaceError";
    ENUM_ERRORS["SocketError"] = "SocketError";
})(ENUM_ERRORS || (ENUM_ERRORS = {}));
/* CONSTANTS */
export const kUserAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0",
    "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36",
];
// helper funtion to create request header and https prpxy agent for fetch
export const fetchConfig = (host, port, timeout) => {
    // 5 second timeout to fetch response
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return {
        // headers inspired from https://oxylabs.io/blog/5-key-http-headers-for-web-scraping
        config: {
            headers: {
                "User-Agent": kUserAgents[Math.floor(Math.random() * kUserAgents.length)],
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
export const curlPingConfig = `namelookup: %{time_namelookup}, connect: %{time_connect}, appconnect: %{time_appconnect}, pretransfer: %{time_pretransfer}, redirect: %{time_redirect}, starttransfer: %{time_starttransfer}, total: %{time_total}`;
