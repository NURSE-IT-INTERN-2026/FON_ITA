FROM node:22-alpine AS base

WORKDIR /app

# ติดตั้ง dependencies
COPY package*.json ./
RUN npm ci

# Copy โค้ดทั้งหมดและ build
COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3008
ENV PORT=3008
ENV NODE_ENV=production

# ต้องมี DATABASE_URL ชี้ไปที่ Postgres ของ Dokploy ก่อน container จะ start ได้
# (schema ยังไม่มีอยู่เลยจนกว่าจะรัน migrate deploy ครั้งแรก)
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]