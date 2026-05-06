FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/nginx.conf
# Certs are mounted at runtime via docker-compose volume
RUN mkdir -p /etc/nginx/certs
EXPOSE 80 443
