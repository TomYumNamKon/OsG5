// ===============================
// main.js — CodeDrop Frontend
// ===============================

// ----------- DOM BINDINGS -----------
const dropZone      = document.getElementById('dropZone');         // กล่องลากวางไฟล์
const btnAdd        = document.getElementById('btnAdd');           // ปุ่มเลือกไฟล์
const fileInput     = document.getElementById('fileInput');        // input type="file"
const fileContainer = document.getElementById('fileContainer');    // กล่องรายการไฟล์
const fileList      = document.getElementById('fileList');         // พื้นที่แสดงรายการไฟล์
const fileCountEl   = document.getElementById('fileCount');        // ตัวเลขจำนวนไฟล์
const fileSizeEl    = document.getElementById('fileSize');         // ขนาดรวมไฟล์
const resetBtn      = document.getElementById('resetFiles');       // ปุ่มล้างรายการ
const btnUpload     = document.getElementById('btnUpload');        // ปุ่มอัปโหลด
const keyInput      = document.getElementById('key');              // ช่องกรอกรหัสรับไฟล์
const btnDl         = document.getElementById('btnDownload');      // ปุ่มดาวน์โหลด
const shareCard     = document.getElementById('shareCard');        // การ์ดแชร์ลิงก์/โค้ด
const bigCodeEl     = document.getElementById('bigCode');          // ตัวเลขใหญ่ 6 หลัก
const shareUrlEl    = document.getElementById('shareUrl');         // กล่องลิงก์ดาวน์โหลด
const copyUrlBtn    = document.getElementById('copyUrl');          // ปุ่มคัดลอกลิงก์
const qrShare       = document.getElementById('qrShare');          // รูป QR
const shareHint     = document.getElementById('shareHint');        // คำอธิบาย/หมดเวลา

// ----------- STATE -----------
let selectedFiles = [];                                            // อาร์เรย์ไฟล์ที่เลือก
let countdownTimerId = null;                                       // id ตัวจับเวลานับถอยหลัง

// ----------- UTILITIES -----------
/** แปลง byte เป็นข้อความอ่านง่าย (เช่น 12.3 MB) */
function humanSize(bytes) {
  // ถ้าน้อยกว่า 1024 แสดงเป็น B
  if (bytes < 1024) return `${bytes} B`;
  // ถ้าน้อยกว่า 1 MB แสดงเป็น KB
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  // ถ้าน้อยกว่า 1 GB แสดงเป็น MB
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  // อื่นๆ แสดงเป็น GB
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** ลบไฟล์ซ้ำ โดยเทียบ name+size+lastModified */
function dedupeFiles(list) {
  // ใช้ Map เก็บ signature เพื่อตัดซ้ำ
  const seen = new Map();
  // สร้างอาร์เรย์ใหม่จากการกรอง
  return Array.from(list).filter(f => {
    const sig = `${f.name}__${f.size}__${f.lastModified}`;        // สร้าง signature
    if (seen.has(sig)) return false;                               // ถ้ามีแล้ว = ซ้ำ
    seen.set(sig, true);                                           // ยังไม่เคยมี เก็บไว้
    return true;                                                   // ผ่าน
  });
}

/** นับถอยหลังเป็นวินาที พร้อมอัปเดต element */
function startCountdown(seconds, el) {
  // ถ้ามี timer เก่าอยู่ ให้เคลียร์ก่อน
  if (countdownTimerId) clearInterval(countdownTimerId);
  // เริ่ม interval ทุก 1 วินาที
  countdownTimerId = setInterval(() => {
    // คำนวณนาทีและวินาที
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    // อัปเดตข้อความใน element
    el.textContent = `${m}:${s}`;
    // เปลี่ยนสีเมื่อใกล้หมดเวลา
    if (seconds <= 60) el.classList.add('danger'); else el.classList.remove('danger');
    // ลดเวลาลง 1 วินาที
    seconds--;
    // ถ้าหมดเวลาแล้ว
    if (seconds < 0) {
      clearInterval(countdownTimerId);                             // หยุดตัวจับเวลา
      el.textContent = '00:00';                                    // แสดง 00:00
      el.classList.add('expired');                                 // ใส่สถานะหมดเวลา
    }
  }, 1000);
}

/** เรนเดอร์รายการไฟล์ที่เลือกไว้ */
function renderFileList() {
  // เคลียร์พื้นที่รายการเดิม
  fileList.innerHTML = '';
  // รวมขนาดไฟล์ทั้งหมด
  let totalSize = 0;
  // วนแสดงไฟล์ทีละรายการ
  selectedFiles.forEach((f, i) => {
    totalSize += f.size;                                           // บวกขนาดไฟล์รวม
    // สร้าง div สำหรับไฟล์
    const item = document.createElement('div');                    // สร้างบล็อกไฟล์
    item.className = 'file-item';                                  // ใส่คลาสตกแต่ง
    // สร้าง HTML ภายในแต่ละรายการ
    item.innerHTML = `
      <div class="file-name">
        <span class="icon">📄</span>
        <span>${f.name}</span>
      </div>
      <div class="file-right">
        <span>${humanSize(f.size)}</span>
        <button class="remove" data-idx="${i}" aria-label="remove">×</button>
      </div>`;
    fileList.appendChild(item);                                    // ใส่ลงรายการหลัก
  });
  // เปิด/ปิด กล่องรายการไฟล์ ขึ้นกับว่ามีไฟล์หรือไม่
  fileContainer.style.display = selectedFiles.length ? 'block' : 'none';
  // อัปเดตจำนวนไฟล์
  fileCountEl.textContent = `${selectedFiles.length} ไฟล์`;
  // อัปเดตขนาดรวม
  fileSizeEl.textContent = humanSize(totalSize);
}

/** รวมไฟล์ใหม่เข้า selectedFiles + ตัดซ้ำ + render */
function addFiles(fileListLike) {
  // แปลงเป็นอาร์เรย์และตัดซ้ำ
  const incoming = dedupeFiles(fileListLike);
  // รวมกับของเดิม แล้วตัดซ้ำอีกรอบ กันเผื่อผู้ใช้เลือกซ้ำ
  selectedFiles = dedupeFiles([...selectedFiles, ...incoming]);
  // เรนเดอร์ใหม่
  renderFileList();
}

// ----------- DRAG & DROP -----------
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();                                              // กันเบราว์เซอร์เปิดไฟล์
  dropZone.classList.add('drag-over');                             // ใส่สไตล์ตอนลากอยู่
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');                          // เอาสไตล์ออกเมื่อออกนอกกล่อง
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();                                              // กัน default เปิดไฟล์
  dropZone.classList.remove('drag-over');                          // ลบสไตล์ลากอยู่
  if (!e.dataTransfer || !e.dataTransfer.files?.length) return;    // ถ้าไม่มีไฟล์ก็จบ
  addFiles(e.dataTransfer.files);                                  // เพิ่มไฟล์เข้า state
});

// ----------- FILE PICKER -----------
btnAdd.addEventListener('click', () => {
  fileInput.click();                                               // เปิด file picker
});

fileInput.addEventListener('change', () => {
  if (!fileInput.files?.length) return;                            // ถ้าไม่เลือกอะไรก็ออก
  addFiles(fileInput.files);                                       // เพิ่มไฟล์เข้า state
  fileInput.value = '';                                            // รีเซ็ตให้เลือกซ้ำได้
});

// ----------- REMOVE & RESET -----------
fileList.addEventListener('click', (e) => {
  // ตรวจว่ากดปุ่มลบหรือไม่
  if (e.target && e.target.classList.contains('remove')) {
    const idx = Number(e.target.getAttribute('data-idx'));         // ดึง index จาก data-idx
    // ลบไฟล์ตำแหน่งนั้น
    selectedFiles.splice(idx, 1);                                  // ตัดออกจากอาร์เรย์
    renderFileList();                                              // เรนเดอร์ใหม่
  }
});

resetBtn.addEventListener('click', () => {
  selectedFiles = [];                                              // เคลียร์อาร์เรย์ไฟล์
  renderFileList();                                                // เรนเดอร์ใหม่ (จะซ่อนกล่องเอง)
});

// ----------- UPLOAD (WITH PROGRESS) -----------
btnUpload.addEventListener('click', () => {
  if (!selectedFiles.length) {                                     // ถ้ายังไม่เลือกไฟล์
    alert('ยังไม่ได้เลือกไฟล์เลยเว้ย!');                           // แจ้งเตือน
    return;                                                        // ยุติ
  }

  // ปิดปุ่มกันกดซ้ำ
  btnUpload.disabled = true;                                       // disabled ปุ่มอัปโหลด
  // เปลี่ยนข้อความบอกสถานะเริ่มต้น
  btnUpload.textContent = 'Uploading 0%…';                         // เริ่มต้นที่ 0%

  // สร้าง FormData ใส่ไฟล์ทั้งหมดแบบชื่อ key = "file"
  const fd = new FormData();                                       // สร้าง FormData
  selectedFiles.forEach(f => fd.append('file', f));                // ใส่ไฟล์ทั้งหมด

  // ใช้ XMLHttpRequest เพื่อดู progress ได้
  const xhr = new XMLHttpRequest();                                // สร้าง XHR
  xhr.open('POST', '/upload');                                     // เปิดเมธอด POST ไป /upload

  // อัปเดตเปอร์เซ็นต์ตอนอัปโหลด
  xhr.upload.onprogress = (evt) => {
    if (evt.lengthComputable) {                                    // ถ้าคำนวณขนาดได้
      const percent = Math.round((evt.loaded / evt.total) * 100);  // คิด %
      btnUpload.textContent = `Uploading ${percent}%…`;            // อัปเดตข้อความ
    }
  };

  // เมื่ออัปโหลดเสร็จ (สำเร็จหรือไม่สำเร็จจะมาที่นี่)
  xhr.onload = async () => {
    try {
      if (xhr.status < 200 || xhr.status >= 300) {                 // ถ้า status ไม่ใช่ 2xx
        throw new Error('อัปโหลดไม่สำเร็จ');                        // โยน error
      }

      // แปลง JSON เพื่อนำ code มาใช้
      const { code, expiresIn = 600 } = JSON.parse(xhr.responseText); // ดึง code + อายุลิงก์ (ดีฟอลต์ 600 วิ)

      // สร้าง URL ดาวน์โหลดจาก code
      const url = `${location.origin}/download/${code}`;           // ลิงก์ดาวน์โหลด

      // แสดงการ์ดแชร์
      bigCodeEl.textContent = code;                                // โค้ด 6 หลัก
      shareUrlEl.value = url;                                      // ลิงก์ดาวน์โหลด
      shareCard.style.display = 'block';                           // โชว์การ์ด Share

      // ใส่คำอธิบายและตัวจับเวลาหมดอายุ
      shareHint.innerHTML = `ลิงก์นี้จะหมดอายุภายในเวลา: ⏳ <span id="countdown">--:--</span>`; // ข้อความพร้อม span นับถอยหลัง
      const countdownEl = document.getElementById('countdown');    // อ้างอิง span
      startCountdown(Number(expiresIn) || 600, countdownEl);       // เริ่มนับถอยหลัง

      // ขอ QR code จาก backend
      try {
        const qrRes = await fetch('/qrcode', {                     // เรียก API /qrcode
          method: 'POST',                                          // POST
          headers: { 'Content-Type': 'application/json' },         // บอกว่าเป็น JSON
          body: JSON.stringify({ url })                            // ส่ง {url: "..."} ไป
        });
        if (qrRes.ok) {                                            // ถ้าได้ 2xx
          const { qr } = await qrRes.json();                       // อ่าน JSON ตอบกลับ
          qrShare.src = qr;                                        // ใส่ src รูป QR
          qrShare.alt = 'Share QR';                                // ใส่ alt ให้อ่านหน้าจอได้
        } else {
          qrShare.alt = 'เกิดข้อผิดพลาดระหว่างสร้าง QR';             // แจ้ง alt หากผิดพลาด
        }
      } catch (_) {
        qrShare.alt = 'ไม่สามารถสร้าง QR ได้';                       // แจ้ง alt หาก fetch ล้มเหลว
      }

      // อัปเดตสถานะปุ่มกลับเป็นพร้อมใช้งาน
      btnUpload.textContent = 'อัปโหลดเลย 🚀';                       // รีเซ็ตข้อความปุ่ม
      btnUpload.disabled = false;                                   // เปิดปุ่มกลับ
      // เคลียร์รายการไฟล์หลังอัปโหลดสำเร็จ
      selectedFiles = [];                                           // ล้าง state
      renderFileList();                                             // เรนเดอร์ใหม่

    } catch (err) {
      // แจ้งเตือนเมื่อมีข้อผิดพลาด
      alert('❌ เกิดข้อผิดพลาด: ' + (err?.message || 'Upload error')); // แสดงข้อความผิดพลาด
      btnUpload.textContent = 'อัปโหลดเลย 🚀';                         // รีเซ็ตข้อความปุ่ม
      btnUpload.disabled = false;                                     // เปิดปุ่มกลับ
    }
  };

  // เมื่อเกิดข้อผิดพลาดระดับเครือข่าย
  xhr.onerror = () => {
    alert('❌ เครือข่ายมีปัญหา อัปโหลดไม่สำเร็จ');                // แจ้งเครือข่ายล้มเหลว
    btnUpload.textContent = 'อัปโหลดเลย 🚀';                         // รีเซ็ตข้อความ
    btnUpload.disabled = false;                                      // เปิดปุ่มกลับ
  };

  // ส่งข้อมูลจริง
  xhr.send(fd);                                                     // เริ่มอัปโหลด
});

// ----------- COPY URL -----------
copyUrlBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrlEl.value);          // คัดลอกไปคลิปบอร์ด
    copyUrlBtn.textContent = 'Copied!';                             // เปลี่ยนข้อความชั่วคราว
    setTimeout(() => (copyUrlBtn.textContent = 'Copy'), 1200);      // กลับเป็น Copy
  } catch {
    // ถ้า API ใหม่ใช้ไม่ได้ ใช้วิธีเก่า
    shareUrlEl.select();                                            // เลือกข้อความ
    document.execCommand('copy');                                   // สั่งคัดลอกแบบเดิม
  }
});

// ----------- DOWNLOAD BY KEY -----------
btnDl.addEventListener('click', () => {
  const code = (keyInput.value || '').trim();                      // อ่านค่ารหัสจาก input
  if (!/^\d{6}$/.test(code)) {                                     // ตรวจรูปแบบ 6 หลัก
    alert('กรุณากรอกเลข 6 หลัก');                                  // แจ้งเตือนถ้าไม่ถูกต้อง
    return;                                                         // ยุติ
  }
  location.href = `/download/${code}`;                              // ไปหน้าดาวน์โหลด
});

// ----------- HELP PANEL -----------
const helpToggle = document.getElementById('helpToggle');
const helpPanel = document.getElementById('helpPanel');

// เปิด/ปิด help panel เมื่อคลิกปุ่ม
helpToggle.addEventListener('click', (e) => {
  e.stopPropagation(); // กันการ bubble ขึ้นไปปิดเอง
  helpPanel.classList.toggle('show');
});

// ปิด panel เมื่อคลิกที่อื่น (นอกกล่อง help)
document.addEventListener('click', (e) => {
  const isClickInside = helpPanel.contains(e.target) || helpToggle.contains(e.target);
  if (!isClickInside && helpPanel.classList.contains('show')) {
    helpPanel.classList.remove('show');
  }
});




