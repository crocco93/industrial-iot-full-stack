# Multi-stage build for React TypeScript application
FROM node:20-alpine as build

WORKDIR /app

# DODAJ ARGs dla VITE variables:
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_N8N_URL  
ARG VITE_LLM_URL

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build application (używa ARG jako ENV)
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_N8N_URL=$VITE_N8N_URL
ENV VITE_LLM_URL=$VITE_LLM_URL

RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
