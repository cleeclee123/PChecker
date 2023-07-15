import redis 

cn = redis.Redis('localhost', 6379)

print(cn.get("hello"))

print("hello")