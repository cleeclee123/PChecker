import os
import subprocess
import json
import requests
from random import randint
from platform import system as system_name
from subprocess import call as system_call

try:
    from urllib.request import urlopen
except ImportError:
    from urllib3 import urlopen


def ping(host):
    fn = open(os.devnull, 'w')
    param = '-n' if system_name().lower() == 'windows' else '-c'
    command = ['ping', param, '1', host]
    retcode = system_call(command, stdout=fn, stderr=subprocess.STDOUT)
    fn.close()
    return retcode == 0


leak_id = randint(1000000, 9999999)
for x in range(0, 10):
    ping('.'.join([str(x), str(leak_id), "bash.ws"]))

proxy = "https://168.11.52.41:8080"
response = requests.get("https://bash.ws/dnsleak/test/"+str(leak_id)+"?json", proxies={'https': proxy})
parsed_data = response.json()   # .read().decode("utf-8")
# parsed_data = json.loads(data)

print("Your IP:")
for dns_server in parsed_data:
    if dns_server['type'] == "ip":
        if dns_server['country_name']:
            if dns_server['asn']:
                print(dns_server['ip']+" ["+dns_server['country_name']+", " +
                      dns_server['asn']+"]")
            else:
                print(dns_server['ip']+" ["+dns_server['country_name']+"]")
        else:
            print(dns_server['ip'])

servers = 0
for dns_server in parsed_data:
    if dns_server['type'] == "dns":
        servers = servers + 1

if servers == 0:
    print("No DNS servers found")
else:
    print("You use "+str(servers)+" DNS servers:")
    for dns_server in parsed_data:
        if dns_server['type'] == "dns":
            if dns_server['country_name']:
                if dns_server['asn']:
                    print(dns_server['ip']+" ["+dns_server['country_name'] +
                          ", " + dns_server['asn']+"]")
                else:
                    print(dns_server['ip']+" ["+dns_server['country_name']+"]")
            else:
                print(dns_server['ip'])

print("Conclusion:")
for dns_server in parsed_data:
    if dns_server['type'] == "conclusion":
        if dns_server['ip']:
            print(dns_server['ip'])
