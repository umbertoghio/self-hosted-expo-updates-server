<h2 align="center">Docker Tips Self Hosted Expo Updates Server</h2>

# Important:
* Double check parameters in your docker compose file
* If using portainer, you must indicate absolute volume paths. Ie:
  * **/host/absolute/path/to/updates:/updates**
  * **/host/absolute/path/to/uploads:/uploads**
* **FEATHERS_AUTH_SECRET** Can be created here https://jwtsecret.com/generate
* **TRIPLE CHECK** `MONGO_CONN` `PUBLIC_URL` `API_BASE_URL` `MONGO_INITDB_ROOT_PASSWORD`
* If you changed `MONGO_INITDB_ROOT_PASSWORD` or ANY parameter of the mongo DB connection string in `MONGO_CONN` remember to update it in *mongoinit/init.js*

# Example Apache config for reverse proxy
## Example parameters
* Docker api server ports `4300:3000`
* Docker front end port `4080:8080`
* `PUBLIC_URL`: https://updatesapi.testdomain.com
* `API_BASE_URL`: https://updatesapi.testdomain.com
* Frontend url https://updates.testdomain.com

You have to configure your host for Apache to resolve https://updates.testdomain.com and https://updatesapi.testdomain.com

## Apache proxy config for API
This configs assume that your docker stack and the web server are in the same host, if not, you must change the localhost occurrences
```
<Proxy />
    Allow from localhost
</Proxy>

ProxyPreserveHost On
ProxyPass /.well-known/ !
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Port "443"

ProxyPass "/socket.io" "ws://localhost:4300/socket.io"
ProxyPassReverse "/socket.io" "ws://localhost:4300/socket.io"

ProxyPass "/" "http://localhost:4300/"
ProxyPassReverse "/" "http://localhost:4300/"
```

## Apache proxy config for web interface
```
<Proxy />
    Allow from localhost
</Proxy>

ProxyPreserveHost On
ProxyPass /.well-known/ !
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Port "443"

ProxyPass "/" "http://localhost:4080/"
ProxyPassReverse "/" "http://localhost:4080/"
```
