#!/bin/sh
cd /server
yarn config set cache-folder $YARN_CACHE_FOLDER
(yarn check --integrity && yarn check --verify-tree) || yarn install --frozen-lockfile

# Startup NodeJS
cd /server
yarn nodemon --inspect=0.0.0.0 --trace-warnings src/index.js
