#!/usr/bin/env python

import flask
from flask import Response, jsonify
import time
import os
from datetime import datetime
import requests
from bs4 import BeautifulSoup
import json

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


app = flask.Flask(__name__)


@app.route('/')
def hello():
    welcome = {"hi": "Welcome to the Proxy retriever service for the PChecker API"}
    welcomeJSON = jsonify(welcome)
    return welcomeJSON


@app.route('/time')
def doyouhavethetime():
    def generate():
        while True:
            yield "{}\n".format(datetime.now().isoformat())
            time.sleep(1)
    r = Response(generate(), mimetype='text/plain')
    return r


@app.route('/singleproxiesGH')
def getSingleProxiesGH():
    def generate():
        linkCount = 0
        tempCount = 0
        while linkCount < len(githubRepoProxies):
            proxyList = getProxiesGH(githubRepoProxies[linkCount])
            proxyListCount = len(getProxiesGH(githubRepoProxies[linkCount])) - 1
            linkCount += 1
            while proxyListCount >= 0:
                yield f'{tempCount} {json.dumps(proxyList[proxyListCount])} \n' 
                tempCount += 1
                proxyListCount -= 1
                time.sleep(0.01)

    r = Response(generate(), mimetype='text/plain')
    return r


@app.route('/singleproxiesDS')
def getSingleProxiesDS():

    def generate():
        linkCount = 0
        tempCount = 0
        while linkCount < len(didsoftProxies):
            proxyList = getProxiesDS(didsoftProxies[linkCount])
            proxyListCount = len(getProxiesDS(didsoftProxies[linkCount])) - 1
            linkCount += 1
            while proxyListCount >= 0:
                yield f'{tempCount} {json.dumps(proxyList[proxyListCount])} \n' 
                tempCount += 1
                proxyListCount -= 1
                time.sleep(0.01)

    r = Response(generate(), mimetype='text/plain')
    return r


@app.route('/proxiesGH')
def getProxiesListGH():

    def generate():
        for linkGH in githubRepoProxies:
            proxyList = getProxiesGH(linkGH)
            yield json.dumps(proxyList) + "\n"
            time.sleep(1)

    r = Response(generate(), mimetype='text/plain')
    return r


@app.route('/proxiesDS')
def getProxiesListDS():

    def generate():
        for linkDS in didsoftProxies:
            proxyList = getProxiesDS(linkDS)
            yield json.dumps(proxyList) + "\n"
            time.sleep(1)

    r = Response(generate(), mimetype='text/plain')
    return r


@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'max-age=300'
    return response


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host='0.0.0.0', port=port)
