// Almacenamiento de archivos separado de la aplicación:
//  - 's3'   : cualquier servicio compatible S3 (Railway Buckets, Cloudflare R2, AWS S3, MinIO)
//  - 'local': carpeta en un Volumen persistente de Railway (UPLOAD_DIR)
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const c = config.storage;
let s3, S3;

async function s3client() {
  if (!s3) {
    S3 = await import('@aws-sdk/client-s3');
    s3 = new S3.S3Client({
      region: c.region, endpoint: c.endpoint, forcePathStyle: !!c.endpoint,
      credentials: c.accessKeyId ? { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } : undefined,
    });
  }
  return s3;
}

const safe = (key) => {
  const p = path.resolve(c.localDir, key);
  if (!p.startsWith(path.resolve(c.localDir))) throw new Error('Ruta no válida');
  return p;
};

export const storage = {
  driver: c.driver,
  async put(key, buffer, mime) {
    if (c.driver === 's3') {
      const cl = await s3client();
      await cl.send(new S3.PutObjectCommand({ Bucket: c.bucket, Key: key, Body: buffer, ContentType: mime }));
    } else {
      const p = safe(key);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, buffer);
    }
  },
  async stream(key) {
    if (c.driver === 's3') {
      const cl = await s3client();
      const r = await cl.send(new S3.GetObjectCommand({ Bucket: c.bucket, Key: key }));
      return r.Body;
    }
    const p = safe(key);
    await fs.access(p);
    return createReadStream(p);
  },
  async remove(key) {
    try {
      if (c.driver === 's3') {
        const cl = await s3client();
        await cl.send(new S3.DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
      } else await fs.unlink(safe(key));
    } catch (e) { console.warn('[storage] no se pudo borrar', key, e.message); }
  },
};
