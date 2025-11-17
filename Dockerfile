# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci

# Install server dependencies
WORKDIR /app/server
RUN npm ci

WORKDIR /app

# Copy source files
COPY . .

# Build Vite app (outputs to dist/ by default)
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine

WORKDIR /app

# Install FFmpeg for video interpolation and nginx for static files
RUN apk add --no-cache ffmpeg nginx

# Copy built frontend from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy server code and dependencies from build stage
COPY --from=build /app/server /app/server
COPY --from=build /app/package.json /app/

# Nginx config to proxy API requests
RUN mkdir -p /etc/nginx/conf.d && \
    echo 'server { \
        listen 80; \
        server_name localhost; \
        root /usr/share/nginx/html; \
        index index.html; \
        location / { \
            try_files $uri $uri/ /index.html; \
        } \
        location /api/ { \
            proxy_pass http://localhost:3002; \
            proxy_http_version 1.1; \
            proxy_set_header Upgrade $http_upgrade; \
            proxy_set_header Connection "upgrade"; \
            proxy_set_header Host $host; \
            proxy_set_header X-Real-IP $remote_addr; \
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
            proxy_set_header X-Forwarded-Proto $scheme; \
            proxy_request_buffering off; \
            proxy_buffering off; \
        } \
    }' > /etc/nginx/conf.d/default.conf

# Expose ports
EXPOSE 80 3002

# Start both nginx and interpolation server
CMD ["sh", "-c", "cd /app/server && npm start & nginx -g 'daemon off;'"]