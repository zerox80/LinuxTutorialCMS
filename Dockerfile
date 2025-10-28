# Build Stage
FROM node:20-alpine as builder

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
RUN npm install

# App bauen
COPY . .
RUN npm run build

# Production Stage mit nginx
FROM nginx:alpine

# Vite Build kopieren
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config
COPY nginx/frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
