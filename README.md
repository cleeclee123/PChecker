# PChecker
Proxy Checker API

Example Response: 

```json
{
  response: {
    HOST: 'myproxyjudgeclee.software',
    CONNECTION: 'close',
    VIA: '1.1 vnode53-proxysvr.vultrcloud-vps.uk-area1.example.com (tinyproxy/1.11.0)',
    USER_AGENT: 'curl/7.83.1',
    ACCEPT: '*/ *',
    ADDR: '104.238.183.155',
    SCHEME: 'http',
    PORT: '36790',
    METHOD: 'GET',
    URI: '/pj-cleeclee123.php',
    TIME_FLOAT: 1673801782.924095,
    TIME: 1673801782
  },
  anonymity: 'Anonymous',
  request: {
    Host: ' myproxyjudgeclee.software',
    'User-Agent': ' curl/7.83.1',
    Accept: ' */ *'
  },
  cause: [ 'VIA' ],
  https: { status: '200', https: true },
  google: true,
  ping: {
    namelookup: ' 0.000034',
    connect: ' 0.080826',
    appconnect: ' 0.000000',
    pretransfer: ' 0.081655',
    redirect: ' 0.000000',
    starttransfer: ' 0.295351',
    total: ' 0.296923'
  },
  location: {
    country: 'United States',
    region: 'California',
    city: 'Santa Clara',
    zip: '95054',
    location: { lat: '37.3931', long: '-121.962' },
    tz: 'America/Los_Angeles',
    isp: 'The Constant Company'
  }
}
```