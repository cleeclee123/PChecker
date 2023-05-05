import subprocess
import concurrent.futures

arr = [["179.96.28.58", "80"],
       ["35.198.37.50", "3129"],
       ["94.103.97.61", "8080"],
       ["35.247.209.139", "3129"],
       ["94.103.97.60", "8080"],
       ["109.194.101.128", "3128"],
       ["140.238.1.77", "8080"],
       ["34.151.232.18", "3129"],
       ["195.133.45.149", "7788"],
       ["51.159.0.236", "3128"],
       ["35.247.253.239", "3129"],
       ["103.69.108.78", "8191"],
       ["185.202.113.34", "8080"],
       ["35.199.73.153", "3129"],
       ["115.144.101.201", "10001"]
       ]

def run_script(ip, port, timeout):
    result = subprocess.run(["node", "../../build/cla/index1.js",
                             ip, port, timeout], capture_output=True, text=True)
    print(result.stdout)
    return result.stdout

def main():
    results_dict = {}

    with concurrent.futures.ProcessPoolExecutor(max_workers=16) as executor:
        future_to_ip = {executor.submit(
            run_script, ip_port[0], ip_port[1], "10000"): ip_port[0] for ip_port in arr}

        for future in concurrent.futures.as_completed(future_to_ip):
            ip = future_to_ip[future]
            result = future.result()
            results_dict[ip] = result

    print(results_dict)

if __name__ == '__main__':
    main()
