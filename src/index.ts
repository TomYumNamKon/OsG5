import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import {serveStatic} from '@hono/node-server/serve-static'

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, "uploads");
const FILE_EXPIRATION_TIME = 10 * 60 * 1000; // 10 mins in ms

if (!fs.existsSync(UPLOAD_DIR))
    fs.mkdirSync(UPLOAD_DIR, {recursive: true});

const files = new Map<string, Array<{ filePath: string, originalFilename: string, mimeType: string }>>();

function generateCode(): string {
  let code: string;
  do {
    code = crypto.randomInt(100000, 999999).toString();
  } while (files.has(code));
  return code;
}

const app = new Hono()

app.post('/upload', async (c) => {
    try {
        const formData = await c.req.formData();
        const uploadedFiles = formData.getAll('file') as File[];

        if (!uploadedFiles || uploadedFiles.length === 0) {
            return c.json({ error: 'No files uploaded' }, 400);
        }

        const code = generateCode();
        const metadataArray: Array<{ filePath: string, originalFilename: string, mimeType: string }> = [];

        for (const file of uploadedFiles) {
            const filePath = path.join(UPLOAD_DIR, `${code}-${file.name}`);
            const fileBuffer = await file.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(fileBuffer));

            metadataArray.push({
                filePath: filePath,
                originalFilename: file.name,
                mimeType: file.type
            });
        }

        files.set(code, metadataArray);

        setTimeout(() => {
            const filesToDelete = files.get(code);
            if (filesToDelete) {
                for (const fileMeta of filesToDelete) {
                    fs.unlink(fileMeta.filePath, (err) => {
                        if (err) console.error(`Failed to delete expired file: ${fileMeta.filePath}`, err);
                    });
                }
            }
            files.delete(code);
            console.log(`Removed metadata and all files for code: ${code}.`);
        }, FILE_EXPIRATION_TIME);

        console.log(`${metadataArray.length} file(s) uploaded ---- Code: ${code}`);
        return c.json({ code });
    } catch (error) {
        console.error('Upload error: ', error);
        return c.json({ error: 'Failed to process file upload' }, 500);
    }
});

app.get('/download/:code', (c) => {
    const { code } = c.req.param();
    const metadataArray = files.get(code);

    if (!metadataArray) {
        return c.text('File(s) not found or have expired.', 404);
    }

    // Case 1: If there's only one file, send it directly.
    if (metadataArray.length === 1) {
        const fileMeta = metadataArray[0];
        console.log(`Single file download requested: ${fileMeta.originalFilename}`);
        const stream = fs.createReadStream(fileMeta.filePath);
        c.header('Content-Type', fileMeta.mimeType);
        c.header('Content-Disposition', `attachment; filename="${fileMeta.originalFilename}"`);
        return c.body(stream as any);
    }
    // Case 2: If there are multiple files, send a ZIP.
    else {
        console.log(`ZIP download requested for code: ${code}`);
        c.header('Content-Type', 'application/zip');
        c.header('Content-Disposition', `attachment; filename="codedrop-${code}.zip"`);

        const archive = archiver('zip', { zlib: { level: 9 } });

        for (const fileMeta of metadataArray) {
            archive.file(fileMeta.filePath, { name: fileMeta.originalFilename });
        }

        archive.finalize();
        return c.body(archive as any);
    }
});

app.post('/qrcode', async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  const qrDataUrl = await qrcode.toDataURL(url, { margin: 1, width: 180 });
  return c.json({ qr: qrDataUrl });
});

const port = 3000;
console.log(`✅ Server is running on port ${port}`);

app.use('*', serveStatic({root: './public'}));

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})