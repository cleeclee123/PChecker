import requests
from bs4 import BeautifulSoup

# get the list of free proxies

# didsoft proxies
def getProxiesDS(link, reqHeader=None):
    proxies = []
    r = requests.get(link)
    soup = BeautifulSoup(r.content, 'html.parser')
    table = soup.find('tbody')
    # proxies = []
    for row in table:
        if row.find_all('td')[4].text == 'elite proxy' or row.find_all('td')[4].text == 'anonymous' or row.find_all('td')[4].text == 'transparent':
            # proxy = ':'.join([row.find_all('td')[0].text,
            #                  row.find_all('td')[1].text])
            proxies.append([row.find_all('td')[0].text,
                           row.find_all('td')[1].text])
        else:
            pass
    return proxies

# proxies scraped from github repos
def getProxiesGH(link, reqHeader=None):
    r = requests.get(link)
    soup = BeautifulSoup(r.content, 'html.parser')
    table = soup.find('table')
    proxies = []
    if (table.find_all('tr')):
        for row in table.find_all('tr'):
            host, port = str(row.select('tr > td')[1].text).split(':')
            proxies.append([host, port])
    return proxies


# format like: ["ip", "port"]
didsoftProxies = [
    "https://free-proxy-list.net/",
    "https://www.us-proxy.org/",
    "https://www.sslproxies.org/"
]

# format like: ["ip", "port"]
githubRepoProxies = [
    "https://github.com/TheSpeedX/PROXY-List/blob/master/http.txt",
    "https://github.com/monosans/proxy-list/blob/main/proxies/http.txt",
    "https://github.com/ShiftyTR/Proxy-List/blob/master/http.txt",
    "https://github.com/ShiftyTR/Proxy-List/blob/master/https.txt",
    "https://github.com/mmpx12/proxy-list/blob/master/http.txt",
    "https://github.com/mmpx12/proxy-list/blob/master/https.txt",
    "https://github.com/zevtyardt/proxy-list/blob/main/http.txt",
    "https://github.com/sunny9577/proxy-scraper/blob/master/proxies.txt",
    "https://github.com/UptimerBot/proxy-list/blob/master/proxies/http.txt",
    "https://github.com/roosterkid/openproxylist/blob/main/HTTPS_RAW.txt",
    "https://github.com/prxchk/proxy-list/blob/main/http.txt",
    "https://github.com/HyperBeats/proxy-list/blob/main/http.txt"
]

for link in didsoftProxies:
    print(getProxiesDS(link))

for link in githubRepoProxies:
    print(getProxiesGH(link))
