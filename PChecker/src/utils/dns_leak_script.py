import os
import subprocess
import requests
import socket
import sys
from random import randint
from platform import system as system_name
from concurrent.futures import ThreadPoolExecutor

from typing import List, Tuple

from timeit import default_timer as timer
import tracemalloc
import ujson as json

class DNSLeakCheck:
    __leak_id: str
    __clientIP: str
    __dnsServersUsed: List[Tuple[str, str, str]] = []
    __conclusion: str
    __parsed_results = {} # JSON
    
    BASH_WS_DNSLEAK_TEST_URL = "https://bash.ws/dnsleak/test/" 
    
    def __init__(self, host: str, port: str, subDomainCount=10, isHTTPS=None):
        if isHTTPS == "False" or isHTTPS == "false":
            self.isHTTPS = False 
        elif isHTTPS == "True" or isHTTPS == "true":
            self.isHTTPS = True 
        else:
            self.isHTTPS = None 
            
        self.subDomainCount = subDomainCount
        try: 
            socket.inet_aton(host)
            # if isHTTPS is not passed in, check both
            if (self.isHTTPS is None):
                self.https_proxy = f"https://{host}:{port}"
                self.http_proxy = f"http://{host}:{port}"
            elif (self.isHTTPS):
                self.https_proxy = f"https://{host}:{port}"
            else:
                self.http_proxy = f"http://{host}:{port}"
        except:
            raise ValueError("Bad IP Address")

    def __ping(self, host):
        fn = open(os.devnull, 'w')
        param = '-n' if system_name().lower() == 'windows' else '-c'
        command = ['ping', param, '1', host]
        
        try:
            subprocess.check_output(command, stderr=subprocess.STDOUT, universal_newlines=True)
        except subprocess.CalledProcessError:
            fn.close()
            return False
        fn.close()
        return True
        # retcode = system_call(command, stdout=fn, stderr=subprocess.STDOUT)
        # return retcode == 0

    def __generate_subdomains(self):
        self.__leak_id = randint(1000000, 9999999)
        subdomains = ['.'.join([str(x), str(self.__leak_id), "bash.ws"]) for x in range(int(self.subDomainCount))]
        
        with ThreadPoolExecutor(max_workers=int(self.subDomainCount)) as executor:
            executor.map(self.__ping, subdomains)
        # for x in range(0, 10):
        #    self.__ping('.'.join([str(x), str(self.__leak_id), "bash.ws"]))
    
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
        try:
            start = timer()
            self.__generate_subdomains()
            self.__make_requests()
            self.__parse_client_ip()
            self.__parse_dns_servers_used()
            self.__is_leaking()
            end = timer()
            
            return {
                "client_ip": self.__clientIP,
                "dns_servers_used_count": len(self.__dnsServersUsed),
                "dns_servers_used": self.__dnsServersUsed,
                "conclusion": self.__conclusion,
                "performance": f"{(end - start) * 1000} ms"
            }
            
        except Exception as e:
            return {
                "error": str(e)
            }

""""
tracemalloc.start()
checker = DNSLeakCheck(host="186.121.235.222", port="8080", isHTTPS=False, subDomainCount=10)
print(json.dumps(checker.generate_report(), indent=4))
print(tracemalloc.get_traced_memory())
tracemalloc.stop()
"""

arg_list = sys.argv

if (len(arg_list) == 5):
    checker = DNSLeakCheck(host=arg_list[1], port=arg_list[2], subDomainCount=arg_list[3], isHTTPS=arg_list[4])
elif (len(arg_list) == 4): 
    checker = DNSLeakCheck(host=arg_list[1], port=arg_list[2], subDomainCount=arg_list[3])
else: 
    print({"error": "Bad Args"})

print(json.dumps(checker.generate_report(), indent=4))