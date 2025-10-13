import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import {serveStatic} from '@hono/node-server/serve-static'

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, "uploads");
// const FILE_EXPIRATION_TIME = 10 * 60 * 1000; // 10 mins in ms
const FILE_EXPIRATION_TIME = 3 * 1000;

if (!fs.existsSync(UPLOAD_DIR))
    fs.mkdirSync(UPLOAD_DIR, {recursive: true});

const files = new Map<string, {filePath: string, originalfileName: string, mimeType: string}>();

function generateCode(): string {
  let code: string;
  do {
    code = crypto.randomInt(100000, 999999).toString();
  } while (files.has(code));
  return code;
}

const app = new Hono()

app.use('*', serveStatic({root: './public'}));

// app.get('/', (c) => {
//   return c.text('File Sharing')
// })

// app.get('/qr/:code', async (c) => {
//   try {
//     const {code} = c.req.param();

//     if (!files.has(code)) return c.json({error: 'Invalid code'}, 404);

//   } catch (err) {
//     console.error('Failed to generate QR code', err);
//     return c.json({ error: 'Failed to generate QR code'}, 500);
//   }
// })

app.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file)
      return c.json({error: 'No file uploaded'}, 400);

    const code = generateCode();
    const filePath = path.join(UPLOAD_DIR, `${code}-${file.name}`);
    const fileBuffer = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));

    files.set(code, {
      filePath: filePath,
      originalfileName: file.name,
      mimeType: file.type
    });

    setTimeout(() => {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`Failed to delete expired file: ${filePath}, err`);
        else console.log(`Deleted expired file: ${filePath}`);
      });
      files.delete(code);
      console.log(`Removed metadata for code: ${code}.`);
    }, FILE_EXPIRATION_TIME);

    console.log(`File uploaded: ${file.name} ---- Code: ${code}`);
    console.log('Current files map', files);

    return c.json({code});
  } catch (error) {
    console.error('Upload error: ', error);
    return c.json({error: 'Failed to process file upload'}, 500);
  }
})

app.get('/download/:code', (c) => {
  const { code } = c.req.param();
  const metadata = files.get(code);

  if (!metadata) return c.text('File not found or has expired', 404);

  console.log(`Download requested for code ${code}: ${metadata.originalfileName}`);
  
  const stream = fs.createReadStream(metadata.filePath);
  c.header('Content-Type', metadata.mimeType);
  c.header('Content-Disposition', `attachment; filename=${metadata.originalfileName}`);
  return c.body(stream as any);
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
