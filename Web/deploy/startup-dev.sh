#!/bin/sh

# Env Loader
cd /app/Deploy
./loadEnv.sh dockerEnv
mv env-config.js /app/public/

# Yarn Setup
cd /app
yarn config set cache-folder $YARN_CACHE_FOLDER
(yarn check --integrity && yarn check --verify-tree) || yarn install --frozen-lockfile

# Startup Vite
yarn vite --port 4000 --host
