FROM node:22-alpine AS base

WORKDIR /app

# ติดตั้ง dependencies
COPY package*.json ./
RUN npm ci

# Copy โค้ดทั้งหมดและ build
COPY . .

# ค่าหลอกสำหรับตอน build เท่านั้น — next build ต้อง import ทุก route (รวม route ที่ใช้
# Prisma) เพื่อเก็บ metadata แม้ route จะเป็น dynamic ก็ตาม จึงต้องมี DATABASE_URL ที่
# parse ได้ (ไม่ต้องต่อฐานจริง) ไม่งั้น build พังตั้งแต่ import module
# host ตั้งใจใช้ชื่อปลอมชัดเจน ไม่ใช่ localhost — กันสับสนกับกรณี DATABASE_URL จริงจาก
# Dokploy ไม่ถูกส่งเข้ามาตอน runtime (ค่านี้ต้องถูกตัวแปรจริงทับตอน container start เสมอ)
ENV DATABASE_URL="postgresql://build:build@build-time-placeholder:5432/build"

RUN npx prisma generate
RUN npm run build

EXPOSE 3008
ENV PORT=3008
ENV NODE_ENV=production

# ต้องมี DATABASE_URL ชี้ไปที่ Postgres ของ Dokploy ก่อน container จะ start ได้
# (schema ยังไม่มีอยู่เลยจนกว่าจะรัน migrate deploy ครั้งแรก)
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]