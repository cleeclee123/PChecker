import os
import subprocess
import requests
import socket
from random import randint
from platform import system as system_name
from subprocess import call as system_call
from typing import List, Tuple

class DNSLeakCheck:
    __leak_id: str
    __clientIP: str
    __dnsServersUsed: List[Tuple[str, str, str]] = []
    __conclusion: str
    __parsed_results = {} # JSON
    
    BASH_WS_DNSLEAK_TEST_URL = "https://bash.ws/dnsleak/test/" 
    
    def __init__(self, host: str, port: str, isHTTPS=None):
        self.isHTTPS = isHTTPS
        try: 
            socket.inet_aton(host)
            # if isHTTPS is not passed in, check both
            if (isHTTPS is None):
                self.https_proxy = f"https://{host}:{port}"
                self.http_proxy = f"http://{host}:{port}"
            elif (isHTTPS):
                self.https_proxy = f"https://{host}:{port}"
            else:
                self.http_proxy = f"http://{host}:{port}"
        except:
            raise ValueError("Bad IP Address")

    def __ping(self, host):
        fn = open(os.devnull, 'w')
        param = '-n' if system_name().lower() == 'windows' else '-c'
        command = ['ping', param, '1', host]
        retcode = system_call(command, stdout=fn, stderr=subprocess.STDOUT)
        fn.close()
        return retcode == 0

    def __generate_subdomains(self):
        self.__leak_id = randint(1000000, 9999999)
        for x in range(0, 10):
            self.__ping('.'.join([str(x), str(self.__leak_id), "bash.ws"]))
    
    def __make_requests(self):
        if (self.isHTTPS is None):
            response = requests.get(f"{self.BASH_WS_DNSLEAK_TEST_URL}{str(self.__leak_id)}?json", proxies={'http':self.http_proxy, 'https':self.https_proxy})
        elif (self.isHTTPS):
            response = requests.get(f"{self.BASH_WS_DNSLEAK_TEST_URL}{str(self.__leak_id)}?json", proxies={'https':self.https_proxy})
        else:
            response = requests.get(f"{self.BASH_WS_DNSLEAK_TEST_URL}{str(self.__leak_id)}?json", proxies={'http':self.http_proxy})
        
        self.__parsed_results = response.json()
    
    def __parse_client_ip(self):
        if (len(self.__parsed_results) == 0): raise ValueError("parsed_results is empty")
        
        for dns_server in self.__parsed_results:
            # should only be size 1
            if dns_server['type'] == "ip": 
                if dns_server['country_name']:
                    if dns_server['asn']:
                        self.__clientIP = (dns_server['ip'], dns_server['country_name'], dns_server['asn'])
                    else:
                        self.__clientIP = (dns_server['ip'], dns_server['country_name'])
                else:
                    self.__clientIP = dns_server['ip'] 
                    
    def __parse_dns_servers_used(self):
        if (len(self.__parsed_results) == 0): raise ValueError("parsed_results is empty")

        servers = 0
        for dns_server in self.__parsed_results:
            if dns_server['type'] == "dns":
                servers = servers + 1

        if servers == 0:
            self.__conclusion = 0
            return
        else:
            print("You use "+str(servers)+" DNS servers:")
            for dns_server in self.__parsed_results:
                if dns_server['type'] == "dns":
                    if dns_server['country_name']:
                        if dns_server['asn']:
                            self.__dnsServersUsed.append((dns_server['ip'], dns_server['country_name'], dns_server['asn']))
                        else:
                            self.__dnsServersUsed.append((dns_server['ip'], dns_server['country_name']))
                    else:
                        self.__dnsServersUsed.append((dns_server['ip']))
                        
    def __is_leaking(self):
        if (len(self.__parsed_results) == 0): raise ValueError("parsed_results is empty")
        
        for dns_server in self.__parsed_results:
            if dns_server['type'] == "conclusion":
                if dns_server['ip']:
                    self.__conclusion = dns_server['ip']
                    
    def generate_report(self):
        self.__generate_subdomains()
        self.__make_requests()
        self.__parse_client_ip()
        self.__parse_dns_servers_used()
        self.__is_leaking()

        return {
            "client_ip": self.__clientIP,
            "dns_servers_used": self.__dnsServersUsed,
            "conclusion": self.__conclusion,
        }

checker = DNSLeakCheck("186.121.235.222", "8080", False)
print(checker.generate_report())