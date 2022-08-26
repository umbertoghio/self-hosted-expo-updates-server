# => Build container
FROM node:16-alpine as builder

WORKDIR /app
COPY . .

RUN yarn install --frozen-lockfile
RUN yarn vite build

# => Run container
FROM nginx:alpine

# Add bash
RUN apk add --no-cache bash

# Nginx config
RUN rm -rf /etc/nginx/conf.d
COPY ./deploy/nginx/conf.d /etc/nginx/conf.d

# Static build
COPY --from=builder /app/dist /usr/share/nginx/html

# Env Loader
COPY ./deploy/dockerEnv /
COPY ./deploy/loadEnv.sh /
RUN chmod +x /loadEnv.sh

COPY ./deploy/startup.sh /
RUN chmod +x /startup.sh

# Default port exposure
EXPOSE 80

# Start Nginx server
CMD ["/startup.sh"]

