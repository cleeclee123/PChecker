import subprocess
import concurrent.futures
import requests
from bs4 import BeautifulSoup

# arr = [
# ["51.79.50.46", "9300"],
# ["204.2.218.145", "8080"],
# ["45.15.16.203", "8118"],
# ["138.2.12.225", "7890"],
# ["35.198.16.85", "3129"],
# ["178.33.3.163", "8080"],
# ["35.198.16.212", "3129"],
# ["35.198.36.111", "3129"],
# ["35.247.236.15", "3129"],
# ["34.98.65.22", "5222"],
# ["196.179.196.18", "8080"],
# ["71.19.248.67", "8001"],
# ["65.21.61.55", "80"],
# ["35.198.35.64", "3129"],
# ["179.96.28.58", "80"],
# ]


def getProxiesList():
    # r = requests.get('https://free-proxy-list.net/')
    r = requests.get('https://www.sslproxies.org/')
    soup = BeautifulSoup(r.content, 'html.parser')
    table = soup.find('tbody')
    proxies = []
    for row in table:
        proxy = []
        if row.find_all('td')[4].text == 'elite proxy' or row.find_all('td')[4].text == 'anonymous' or row.find_all('td')[4].text == 'transparent':
            proxy.append(row.find_all('td')[0].text)
            proxy.append(row.find_all('td')[1].text)
            proxies.append(proxy)
        else:
            pass
    return proxies

# def getProxiesGithub():
#     # r = requests.get('https://github.com/TheSpeedX/PROXY-List/blob/master/socks5.txt')
#     # r = requests.get('https://github.com/jetkai/proxy-list/blob/main/online-proxies/txt/proxies-socks5.txt')
#     r = requests.get(
#         'https://github.com/TheSpeedX/PROXY-List/blob/master/http.txt')
#     soup = BeautifulSoup(r.content, 'html.parser')
#     table = soup.find('table')
#     proxies = []
#     if (table.find_all('tr')):
#         for row in table.find_all('tr'):
#             proxies.append(row.select('tr > td')[1].text)
#     return proxies


def run_script(ip, port, timeout):
    result = subprocess.run(["node", "../../build/cla/index1.js",
                             ip, port, timeout], capture_output=True, text=True)
    print(ip, result.stdout)
    return result.stdout


def main():
    results_dict = {}
    list = getProxiesList()
    # list = getProxiesGithub()
    with concurrent.futures.ProcessPoolExecutor(max_workers=32) as executor:
        future_to_ip = {executor.submit(
            run_script, ip_port[0], ip_port[1], "5000"): ip_port[0] for ip_port in list}
        for future in concurrent.futures.as_completed(future_to_ip):
            ip = future_to_ip[future]
            result = future.result()
            results_dict[ip] = result

    print(results_dict)


if __name__ == '__main__':
    main()
