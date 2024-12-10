FROM node:22-alpine
RUN apk update && apk add --no-cache tzdata
RUN mkdir -p /home/node/server && chown -R node:node /home/node/server
WORKDIR /home/node/server
USER node
COPY --chown=node:node package.json yarn.lock ./

RUN yarn install
RUN yarn cache clean

COPY --chown=node:node . .

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node src/modules/docker/healthcheck.js

CMD ["node", "src/index.js"]
