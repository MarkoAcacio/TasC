# ============================================================
#  TasC – Dockerfile
# ============================================================

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm install --production

# Copy source files
COPY . .

# Expose the app port
EXPOSE 3000

CMD ["node", "server.js"]