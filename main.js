document.addEventListener('DOMContentLoaded', () => {
  const sendBox   = document.getElementById('sendBox');
  const fileInput = document.getElementById('fileInput');
  const keyInput  = document.getElementById('key');
  const btnDl     = document.getElementById('btnDownload');
  const shareCard = document.getElementById('shareCard');
  const bigCodeEl = document.getElementById('bigCode');
  const shareUrlEl= document.getElementById('shareUrl');
  const copyUrlBtn= document.getElementById('copyUrl');
  const shareHint = document.getElementById('shareHint');
  const qrShare   = document.getElementById('qrShare');

  let isUploading = false;

  // --- เปิด file picker ---
  sendBox.addEventListener('click', (e)=>{
    e.preventDefault();
    if (isUploading) return;
    fileInput.click();
  });

  // --- อัปโหลดไฟล์ ---
  fileInput.addEventListener('change', async ()=>{
    const file = fileInput.files && fileInput.files[0];
    if(!file || isUploading) return;

    isUploading = true;
    sendBox.classList.add('busy');

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/upload', { method:'POST', body: fd });

      if(!res.ok){ alert('Upload failed'); return; }

      const { code } = await res.json();
      const url = `${location.origin}/download/${code}`;

      bigCodeEl.textContent = code;
      shareUrlEl.value = url;
      shareCard.style.display = 'block';
      shareHint.textContent = 'ลิงก์ใช้ได้ภายใน 10 นาที';
      keyInput.value = code;

      // 🔹 ขอให้ backend สร้าง QR code แล้วส่งกลับมา
      const resQr = await fetch('/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (resQr.ok) {
        const { qr } = await resQr.json();
        qrShare.src = qr; // base64 image จาก server
      } else {
        console.error('QR generation failed');
      }

    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดระหว่างอัปโหลด');
    } finally {
      isUploading = false;
      sendBox.classList.remove('busy');
      fileInput.value = '';
    }
  });

  // --- Copy URL ---
  copyUrlBtn.addEventListener('click', async ()=>{
    try {
      await navigator.clipboard.writeText(shareUrlEl.value);
      copyUrlBtn.textContent = 'Copied!';
      setTimeout(()=> copyUrlBtn.textContent = 'Copy', 1200);
    } catch {
      shareUrlEl.select(); document.execCommand('copy');
    }
  });

  // --- Download ---
  btnDl.addEventListener('click', ()=>{
    const code = (keyInput.value||'').trim();
    if(!/^\d{6}$/.test(code)){ alert('กรุณากรอกเลข 6 หลัก'); return; }
    location.href = `/download/${code}`;
  });
});
