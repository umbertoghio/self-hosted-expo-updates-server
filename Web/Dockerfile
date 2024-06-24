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
USER 101

# Nginx config
RUN rm -rf /etc/nginx/conf.d
COPY ./deploy/nginx/conf.d /etc/nginx/conf.d

# Static build
COPY --from=builder /app/dist /usr/share/nginx/html

# Env Loader
COPY ./deploy/dockerEnv /
COPY ./deploy/loadEnv.sh /

COPY ./deploy/startup.sh /

# Default port exposure
EXPOSE 8080

# Start Nginx server
CMD ["/startup.sh"]

