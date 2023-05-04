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

  public setHost(host: string): void {
    this.host_ = host;
  }

  public setPort(port: string): void {
    this.port_ = port;
  }

  public setTimeout(timeout: number): void {
    this.timeout_ = timeout;
  }

  public setPublicIP(ip: string): void {
    this.publicIPAddress_ = ip;
  }

  public setUsername(username: string): void {
    this.username_ = username;
  }

  public setPassword(password: string): void {
    this.password_ = password;
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
    this.clear();

    return validResults;
  }

  /**
   * @method: checkAnonymity()
   * @returns Promise<ProxyInfoFromHttp | ProxyError>
   * runs anomnity check
   */
  public async checkAnonymity(): Promise<ProxyInfoFromHttp | ProxyError> {
    const anomnityStatus = await this.checkProxyAnonymity();
    this.clear();

    return anomnityStatus;
  }

  /**
   * @method: checkHTTPS()
   * @returns Promise<ProxyInfoFromHttp | ProxyError>
   * runs https support check
   */
  public async checkHTTPS(): Promise<ProxyInfoFromHttps | ProxyError> {
    const httpsStatus = await this.checkProxyHTTPSSupport();
    this.clear();

    return httpsStatus;
  }

  /**
   * @method: checkContent()
   * @returns Promise<ProxyInfoFromHttp | ProxyError>
   * runs content check
   */
  public async checkContent(): Promise<ProxyContentCheck | ProxyError> {
    const contentCheck = await this.checkProxyContent();
    this.clear();

    return contentCheck;
  }

  /**
   * @method: checkGoogle()
   * @returns Promise<boolean | ProxyError>
   * runs google support check
   */
  public async checkGoogle(): Promise<boolean | ProxyError> {
    const contentCheck = await this.checkProxyGoogleSupport();
    this.clear();

    return contentCheck;
  }

  /**
   * @method: checkDNSLeak()
   * @returns Promise<ProxyDNSCheck | ProxyError>
   * runs dns leak check
   */
  public async checkDNSLeak(): Promise<ProxyDNSCheck | ProxyError> {
    const dnsLeakCheck = await this.checkProxyDNSLeak();
    this.clear();

    return dnsLeakCheck;
  }

  // /**
  //  * @method: checkWebRTCLeak()
  //  * runs webtrc leak check
  //  */
  // public async checkWebRTCLeak() {
  //   const webrtcLeakCheck = await this.checkProxyWebRTCLeak();
  //   this.clear();

  //   return webrtcLeakCheck;
  // }
}
