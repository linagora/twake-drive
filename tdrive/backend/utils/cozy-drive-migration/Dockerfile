# Use official Node 20.19 Alpine image
FROM node:20.19-alpine

# Set working directory
WORKDIR /app

# Install pnpm via npm (more stable than corepack for Alpine)
RUN npm install -g pnpm

# Copy package and lock files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install

# Copy the rest of the app
COPY . .


# Start the app in dev mode
CMD ["npm", "run", "dev"]
