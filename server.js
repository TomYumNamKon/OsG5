// server.js
// เซิร์ฟเวอร์โอนไฟล์แบบใช้ "คีย์ 6 หลัก" พร้อมหมดอายุและลบไฟล์อัตโนมัติ

const path = require('path');                 // จัดการ path
const os = require('os');                     // ใช้โฟลเดอร์ temp
const fs = require('fs');                     // จัดการไฟล์
const fsp = fs.promises;                      // เวอร์ชัน promise
const express = require('express');           // เว็บเฟรมเวิร์ก
const multer = require('multer');             // รับไฟล์อัปโหลด

const app = express();                        // สร้างแอป
const PORT = process.env.PORT || 3000;        // พอร์ต

// ---------- Multer: เก็บไฟล์ลงดิสก์ในโฟลเดอร์ temp ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()), // โฟลเดอร์ชั่วคราว
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-() ]+/g, '_'); // กันชื่อเพี้ยน
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // ลิมิต 2GB (ปรับได้)
});

// ---------- เสิร์ฟไฟล์ static (หน้าเว็บ) ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- ที่เก็บ mapping: code -> metadata ----------
/** @type {Record<string, {path:string, name:string, mime:string, size:number, expireAt:number}>} */
const codes = Object.create(null);
const TTL_MS = 10 * 60 * 1000;                // อายุคีย์ 10 นาที (เหมือนตัวอย่างรูป)

// สร้างเลข 6 หลักแบบไม่ชนกัน
function genCode() {
  let c;
  do c = Math.floor(100000 + Math.random() * 900000).toString();
  while (codes[c]);
  return c;
}

// เคลียร์ไฟล์หมดอายุทุก 1 นาที
setInterval(async () => {
  const now = Date.now();
  for (const [code, meta] of Object.entries(codes)) {
    if (now > meta.expireAt) {
      try { await fsp.unlink(meta.path); } catch {}
      delete codes[code];
    }
  }
}, 60 * 1000);

// ---- วางแทนทั้งหมดของ /upload เดิม ----
const uploadOne = upload.single('file'); // ต้องชื่อฟิลด์ 'file'

app.post('/upload', (req, res) => {
  // ดีบัก: ดู content-type
  console.log('> /upload Content-Type:', req.headers['content-type']);

  // เรียก Multer แบบจับ error เอง
  uploadOne(req, res, async (err) => {
    if (err) {
      // พวก MulterError เช่น file too large
      console.error('Multer error:', err);
      return res.status(400).json({ error: 'UPLOAD_FAILED', detail: String(err) });
    }
    if (!req.file) {
      console.warn('No file field received.');
      return res.status(400).json({ error: 'NO_FILE_FIELD', hint: "ส่งฟิลด์ชื่อ 'file' แบบ multipart/form-data" });
    }

    // ลองตรวจสิทธิ์ไฟล์ชั่วคราว (เผื่อ OS/tmp พัง)
    try {
      await fsp.access(req.file.path, fs.constants.R_OK);
    } catch (e) {
      console.error('Temp file not readable:', e);
      return res.status(500).json({ error: 'TEMP_NOT_READABLE' });
    }

    // สร้างโค้ด + เก็บเมตา
    const code = genCode();
    const meta = {
      path: req.file.path,
      name: req.file.originalname,
      mime: req.file.mimetype || 'application/octet-stream',
      size: req.file.size,
      expireAt: Date.now() + TTL_MS
    };
    codes[code] = meta;

    console.log(`> UPLOADED ${meta.name} (${meta.size}B) -> CODE ${code}`);
    res.json({ code, expiresIn: Math.floor(TTL_MS / 1000) });
  });
});


// ---------- ดาวน์โหลดด้วยคีย์ ----------
app.get('/d/:code', async (req, res) => {
  const code = String(req.params.code || '');
  const meta = codes[code];
  if (!meta) return res.status(404).send('Invalid or expired code');

  if (Date.now() > meta.expireAt) {                                 // เช็คหมดอายุ
    try { await fsp.unlink(meta.path); } catch {}
    delete codes[code];
    return res.status(410).send('Code expired');
  }

  // ตั้ง header ให้ browser ดาวน์โหลดด้วยชื่อไฟล์เดิม
  res.setHeader('Content-Type', meta.mime);
  res.setHeader('Content-Length', meta.size);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.name)}"`);

  // สตรีมไฟล์ไปยังผู้รับ
  const stream = fs.createReadStream(meta.path);
  stream.pipe(res);

  // หลังส่งเสร็จให้ลบไฟล์และลบ code (ใช้ครั้งเดียว)
  stream.on('close', async () => {
    try { await fsp.unlink(meta.path); } catch {}
    delete codes[code];
  });

  // ถ้าส่งไม่สำเร็จ ก็ลบทิ้งเหมือนกัน
  stream.on('error', async () => {
    try { await fsp.unlink(meta.path); } catch {}
    delete codes[code];
    if (!res.headersSent) res.status(500).end('Failed to read file');
  });
});

// ---------- เริ่มเซิร์ฟเวอร์ ----------
app.listen(PORT, () => {
  console.log(`CodeDrop on http://localhost:${PORT}`);
});
