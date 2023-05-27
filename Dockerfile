FROM node:18-alpine
ENV PORT=3002
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["node", "dist/index.js"]
EXPOSE 3002
