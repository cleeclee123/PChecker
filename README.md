# PChecker
## Proxy Validation API

## Example Usage:

```Typescript
const proxyOptions = {
  host: "122.147.138.136",
  port: "8118",
  timeout: "10000",
  publicIPAddress: "64.189.16.65",
  sitesToCheck: [
    "https://google.com",
    "https://finance.yahoo",
    "https://www.google.com/finance",
  ],
  runProxyLocation: true,
} as PCheckerOptions;

const p1 = new PChecker.PChecker(proxyOptions);

let check1: ProxyInfoEssential = await p1.checkEssential();
console.log(check1);
```

### Output
```
[2023-07-30T05:00:20.484Z] info: https connncted
[2023-07-30T05:00:21.023Z] info: https://google.com check status code: 400
[2023-07-30T05:00:21.027Z] info: https://google.com Response Time: 768
[2023-07-30T05:00:21.028Z] info: HTTP Request Socket Closed (https://google.com)
[2023-07-30T05:00:21.219Z] info: https://finance.yahoo check status code: 400
[2023-07-30T05:00:21.220Z] info: https://finance.yahoo Response Time: 959
[2023-07-30T05:00:21.221Z] info: HTTP Request Socket Closed (https://finance.yahoo)
[2023-07-30T05:00:21.228Z] info: checkProxyHTTPS statusCode: 200
[2023-07-30T05:00:21.229Z] info: HTTPS Socket Closed
[2023-07-30T05:00:21.231Z] info: https://www.google.com/finance check status code: 400
[2023-07-30T05:00:21.232Z] info: https://www.google.com/finance Response Time: 970
[2023-07-30T05:00:21.232Z] info: HTTP Request Socket Closed (https://www.google.com/finance)
[2023-07-30T05:00:21.818Z] info: HTTP Request Object Closed (GET_LOCATION)
[2023-07-30T05:00:21.822Z] info: getProxyLocation response time: 1559 ms
[2023-07-30T05:00:21.846Z] info: checkProxyAnonymity status code: 200
[2023-07-30T05:00:21.849Z] info: checkProxyAnonymity network response: 1587
[2023-07-30T05:00:21.851Z] info: pj res: {"host":"198.58.101.166:6969","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246","connection":"keep-alive","addr":"122.147.138.136","port":52890,"scheme":"http","method":"GET","time":1690693221012,"duration":"2.6222049999999997ms"}

{
  google_support: false,
  financeyahoo_support: false,
  googlefinance_support: false,
  anonymity: 'Elite',
  checkAnonymityTime: 1591,
  httpConnectRes: 967,
  https: true,
  countryCode: 'TW',
  proxyString: '122.147.138.136:8118'
}
```