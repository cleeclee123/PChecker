import socket
from itertools import product
import multiprocessing as mp
from time import time

# attempts to connect to socket with passed in ip address on passed in port
# true right away if port is open, to false if port is closed
def checkPort(ip, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.settimeout(1)
        sock.connect((ip, int(port)))
        sock.shutdown(2)
        return True
    except:
        return False

# loops thru http(s) ports and checks if able to connect,
def buildProxy(ip):
    proxies = []
    httpPorts = [80, 8080, 8008, 443]
    _start = time()
    for i in range(len(httpPorts)):
        if (checkPort(ip, httpPorts[i]) == True):
            if (httpPorts[i] == 443):
                proxies.append(f'https://{ip}:{httpPorts[i]}')
            else:
                proxies.append(f'http://{ip}:{httpPorts[i]}')
    print(f"completed in {time() - _start:.2f}")
    return proxies

