# PChecker
Proxy Checker API

Example Response: 

```json
{
  anonymity: 'Anonymous',
  headers: {
    res: {
      HOST: 'myproxyjudgeclee.software',
      CONNECTION: 'close',
      VIA: '1.1 vnode53-proxysvr.vultrcloud-vps.uk-area1.example.com (tinyproxy/1.11.0)',
      USER_AGENT: 'curl/7.83.1',
      ACCEPT: '*/ *',
      ADDR: '104.238.183.155',
      SCHEME: 'http',
      PORT: '53610',
      METHOD: 'GET',
      URI: '/pj-cleeclee123.php',
      TIME_FLOAT: 1673804734.762916,
      TIME: 1673804734
    },
    req: {
      Host: ' myproxyjudgeclee.software',
      'User-Agent': ' curl/7.83.1',
      Accept: ' */ *'
    }
  },
  cause: [ 'VIA' ],
  https: { status: '200', https: true },
  google: true,
  ping: {
    namelookup: '0.000035',
    connect: '0.061915',
    appconnect: '0.000000',
    pretransfer: '0.062552',
    redirect: '0.000000',
    starttransfer: '0.270633',
    total: '0.272036'
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