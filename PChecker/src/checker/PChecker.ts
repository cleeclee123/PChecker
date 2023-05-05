import { PCheckerMethods } from "./PCheckerMethods.js";
import {
  ProxyError,
  ProxyInfoFromHttp,
  ProxyInfoFromHttps,
  ProxyContentCheck,
  ProxyDNSCheck,
} from "./types.js";

export class PChecker extends PCheckerMethods {
  constructor(
    host?: string,
    port?: string,
    timeout?: string,
    publicIPAddress?: string | Promise<string | ProxyError>,
    username?: string,
    password?: string
  ) {
    super(host, port, timeout, publicIPAddress, username, password);
  }

  /**
   * @method: checkAll()
   * @returns Promise<any>
   * runs both anomnity and https check
   */
  public async checkAll(): Promise<any> {
    // promise all error: will only return valid resolved promises
    const promises = [
      this.checkProxyAnonymity(),
      this.checkProxyHTTPSSupport(),
    ];

    const results = await Promise.all(promises.map((p) => p.catch((e) => e)));
    const validResults = results.filter((result) => !(result instanceof Error));

    // clear all timeouts
    this.clearTimeout();

    const json1 = JSON.parse(JSON.stringify(validResults[0]));
    const json2 = JSON.parse(JSON.stringify(validResults[1]));

    return {"anonymity": json1["anonymity"], "rest": json1["responseTime"], "https": json2["response"]};
  }

  /**
   * @method: checkAnonymity()
   * @returns Promise<ProxyInfoFromHttp | ProxyError>
   * runs anomnity check
   */
  public async checkAnonymity(): Promise<ProxyInfoFromHttp | ProxyError> {
    const anomnityStatus = await this.checkProxyAnonymity();
    this.clearTimeout();

    return anomnityStatus;
  }

  /**
   * @method: checkHTTPS()
   * @returns Promise<ProxyInfoFromHttp | ProxyError>
   * runs https support check
   */
  public async checkHTTPS(): Promise<ProxyInfoFromHttps | ProxyError> {
    const httpsStatus = await this.checkProxyHTTPSSupport();
    this.clearTimeout();

    return httpsStatus;
  }

  /**
   * @method: checkContent()
   * @returns Promise<ProxyInfoFromHttp | ProxyError>
   * runs content check
   */
  public async checkContent(): Promise<ProxyContentCheck | ProxyError> {
    const contentCheck = await this.checkProxyContent();
    this.clearTimeout();

    return contentCheck;
  }

  /**
   * @method: checkGoogle()
   * @returns Promise<boolean | ProxyError>
   * runs google support check
   */
  public async checkGoogle(): Promise<boolean | ProxyError> {
    const contentCheck = await this.checkProxyGoogleSupport();
    this.clearTimeout();

    return contentCheck;
  }

  /**
   * @method: checkDNSLeak()
   * @returns Promise<ProxyDNSCheck | ProxyError>
   * runs dns leak check
   */
  public async checkDNSLeak(): Promise<ProxyDNSCheck | ProxyError> {
    const dnsLeakCheck = await this.checkProxyDNSLeak();
    this.clearTimeout();

    return dnsLeakCheck;
  }

  /**
   * @method: checkDNSLeak()
   * @returns Promise<ProxyInfoEssential | ProxyError>
   * returns only essential info
   */
  public async checkEssential(): Promise<any> {
    const essential = await this.checkProxyEssential();
    this.clearTimeout();

    return essential;
  }

  /**
   * @method: checkLocation()
   * @returns Promise<ProxyLocation | ProxyError>
   * returns geolocation data of proxy
   */
  public async checkLocation(): Promise<any> {
    const geoLocation = await this.checkProxyLocation();
    this.clearTimeout();

    return geoLocation;
  }

  // /**
  //  * @method: checkWebRTCLeak()
  //  * runs webtrc leak check
  //  */
  // public async checkWebRTCLeak() {
  //   const webrtcLeakCheck = await this.checkProxyWebRTCLeak();
  //   this.cleartimeout();

  //   return webrtcLeakCheck;
  // }


}
