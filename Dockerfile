# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Build Vite app (outputs to dist/ by default)
RUN npm run build

# ---- Runtime stage ----
FROM nginx:alpine
# Copy built static files to nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html
# Expose default nginx port
EXPOSE 80
# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]