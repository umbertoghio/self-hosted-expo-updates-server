#!/bin/bash
cd /env
./loadEnv.sh dockerEnv
mv env-config.js /usr/share/nginx/html/
chmod a+r /usr/share/nginx/html/env-config.js

# Startup nginx
nginx -g "daemon off;"
