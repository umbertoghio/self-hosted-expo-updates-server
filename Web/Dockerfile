# => Build container
FROM node:16-alpine as builder

WORKDIR /app
COPY . .

RUN yarn install --frozen-lockfile
RUN yarn vite build

# => Run container
FROM nginxinc/nginx-unprivileged:alpine

# Add bash
USER 0
RUN apk add --no-cache bash

# Nginx config
RUN rm -rf /etc/nginx/conf.d
COPY ./deploy/nginx/conf.d /etc/nginx/conf.d

# Static build
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chown -R 101:101 /usr/share/nginx/html

# Env Loader
RUN mkdir /env
COPY ./deploy/dockerEnv /env
COPY ./deploy/loadEnv.sh /env
COPY ./deploy/startup.sh /env
RUN chown -R 101:101 /env

# Default port exposure
EXPOSE 8080

USER 101

# Start Nginx server
CMD ["/env/startup.sh"]

