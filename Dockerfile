# 1. Start from the current LTS version of Node.js

FROM node:22-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package files and install dependencies first (for caching)
COPY package*.json ./
RUN npm install

# 4. Copy the rest of your application's source code
COPY . .

# 5. Tell Docker that your app runs on port 4000
EXPOSE 4000

# 6. The command to run when the container starts
CMD ["npm", "run", "dev"]