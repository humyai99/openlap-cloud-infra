# คู่มือติดตั้งและใช้งาน OpenLab Cloud (ภาษาไทย)

> สถานะ: **Phase 1 เสร็จ** (UI + Mock Provider) · **Phase 2 กำลังพัฒนา** (PostgreSQL, Login, RBAC, Job Queue)
> โค้ด Phase 2 เขียนเสร็จแล้ว แต่ยังไม่ได้ทดสอบกับฐานข้อมูลจริง อาจเจอ error ตอน build

---

## 1. สิ่งที่ต้องมี

| โปรแกรม | เวอร์ชัน | ใช้ทำอะไร |
|---|---|---|
| Node.js | 20 ขึ้นไป (แนะนำ 24) | รันเว็บ |
| Git | ล่าสุด | ดึง/ส่งโค้ด |
| Docker Desktop | ล่าสุด | รัน PostgreSQL |

**Windows:** Docker Desktop ต้องมี WSL ก่อน เปิด PowerShell แบบ Administrator แล้วรัน

```powershell
wsl --install
```

จากนั้นรีสตาร์ทเครื่อง แล้วเปิด Docker Desktop ให้ขึ้นสถานะ "Engine running"

---

## 2. ดึงโค้ดลงเครื่อง

```bash
git clone https://github.com/humyai99/openlap-cloud-infra.git
cd openlap-cloud-infra
npm install
```

`npm install` จะรัน `prisma generate` ให้อัตโนมัติ

---

## 3. ตั้งค่าไฟล์ `.env`

ไฟล์ `.env` เก็บรหัสผ่านและ secret **ไม่ได้อยู่ใน GitHub** (ถูก ignore ไว้) ต้องสร้างเองทุกเครื่อง

```bash
cp .env.example .env
```

แล้วแก้ค่าในไฟล์ `.env`

| ตัวแปร | ความหมาย | วิธีสร้างค่า |
|---|---|---|
| `POSTGRES_PASSWORD` | รหัสผ่าน PostgreSQL | ตั้งเอง (ยาวๆ) |
| `DATABASE_URL` | ใส่รหัสเดียวกับด้านบน | `postgresql://openlab:<รหัส>@localhost:5432/openlab` |
| `AUTH_SECRET` | secret สำหรับ session | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `OPENLAB_ENCRYPTION_KEY` | กุญแจเข้ารหัส credential ของ Hypervisor (ต้อง 32 byte) | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SEED_ADMIN_PASSWORD` | รหัสผ่านของ admin ตอน seed | ตั้งเอง อย่างน้อย 8 ตัว |
| `OPENLAB_PROVIDER` | `mock` (ยังไม่ต่อ Hypervisor จริง) | — |
| `OPENLAB_INPROCESS_WORKER` | `true` = รัน worker ในตัวเว็บ (สำหรับ dev) | — |

> ⚠️ ห้าม commit ไฟล์ `.env` ขึ้น GitHub และอย่าส่งค่าในไฟล์นี้ทางแชท/อีเมล

---

## 4. เปิดฐานข้อมูลและสร้างตาราง

```bash
npm run db:up        # เปิด PostgreSQL ใน Docker
npm run db:migrate   # สร้างตารางตาม prisma/schema.prisma (ครั้งแรกจะถามชื่อ migration ให้ตั้งเช่น init)
npm run db:seed      # ใส่ข้อมูลตัวอย่าง: node, VM, network, user, role
```

---

## 5. รันเว็บ

```bash
npm run dev
```

เปิดเบราว์เซอร์ที่ http://localhost:3000 แล้ว Login ด้วย

- Email: `admin@openlab.local`
- Password: ค่า `SEED_ADMIN_PASSWORD` ในไฟล์ `.env`

### แยก Worker (สำหรับ production)

ตั้ง `OPENLAB_INPROCESS_WORKER=false` แล้วเปิดอีกหน้าต่าง

```bash
npm run worker
```

---

## 6. คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันโหมดพัฒนา |
| `npm run build` | build production |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm run lint` | ตรวจโค้ด |
| `npm run db:reset` | ล้างฐานข้อมูลแล้วสร้างใหม่ (ข้อมูลหายหมด) |
| `npx prisma studio` | เปิดหน้าเว็บดูข้อมูลในฐานข้อมูล |

---

## 7. ส่งโค้ดขึ้น GitHub หลังแก้ไข

```bash
git status                     # ดูว่าไฟล์ไหนเปลี่ยน
git add -A                     # เลือกไฟล์ทั้งหมด (ไฟล์ใน .gitignore จะไม่ถูกเลือก)
git commit -m "อธิบายสิ่งที่แก้"
git push                       # ส่งขึ้น GitHub
```

ดึงโค้ดล่าสุดจาก GitHub (เช่น แก้จากอีกเครื่อง)

```bash
git pull
```

ครั้งแรกที่ push บน Windows จะมีหน้าต่าง Git Credential Manager ให้ Login GitHub ผ่านเบราว์เซอร์ ไม่ต้องใส่รหัสผ่านใน Terminal

---

## 8. แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `failed to connect to the docker API` | Docker Desktop ยังไม่เปิด หรือยังไม่ได้ติดตั้ง WSL (ดูข้อ 1) |
| `DB_UNAVAILABLE` / `Can't reach database server` | PostgreSQL ยังไม่รัน → `npm run db:up` และเช็ค `DATABASE_URL` |
| `OPENLAB_ENCRYPTION_KEY must be 32 bytes` | สร้างค่าใหม่ด้วยคำสั่งในข้อ 3 |
| Login ไม่ได้ | ยังไม่ได้ `npm run db:seed` หรือรหัสไม่ตรง `SEED_ADMIN_PASSWORD` |
| `Too many requests` | ระบบกัน brute force: login ผิดเกิน 10 ครั้ง/นาที ให้รอ 1 นาที |
| `not a valid Win32 application` (swc) | ไฟล์ติดตั้งเสีย → ลบ `node_modules` แล้ว `npm install` ใหม่ |

---

## 9. โครงสร้างระบบโดยย่อ

```
Browser → Next.js (หน้าเว็บ + REST API /api/v1)
        → Service Layer (สิทธิ์ RBAC, Quota, Audit Log)
        → Job Queue ใน PostgreSQL
        → Worker → Provider Adapter (mock / Incus / libvirt)
        → Hypervisor
```

- **Phase 1** ✅ UI, Mock Data
- **Phase 2** 🚧 PostgreSQL, Login, RBAC, Job Queue, API Key
- **Phase 3** ⏳ เชื่อม Incus จริง แล้วตามด้วย libvirt/KVM, noVNC Console, Prometheus
