import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../database';
import { authenticate } from '../middleware/auth';

const router = Router();

const UPLOAD_PATH = process.env.UPLOAD_PATH || './uploads';
const PHOTOS_PATH = path.join(UPLOAD_PATH, 'photos');
const DOCS_PATH = path.join(UPLOAD_PATH, 'documents');

[UPLOAD_PATH, PHOTOS_PATH, DOCS_PATH].forEach(p => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOCS = [...ALLOWED_IMAGE, 'application/pdf'];

function createStorage(dest: string) {
  return multer.diskStorage({
    destination: (_, __, cb) => cb(null, dest),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

const photoUpload = multer({
  storage: createStorage(PHOTOS_PATH),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (ALLOWED_IMAGE.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP images allowed'));
  },
});

const docUpload = multer({
  storage: createStorage(DOCS_PATH),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (ALLOWED_DOCS.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images and PDF files allowed'));
  },
});

router.post('/photo', authenticate, photoUpload.single('photo'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/photos/${req.file.filename}`;
  return res.json({ url, filename: req.file.filename });
});

router.post('/document/:customerId', authenticate, docUpload.single('document'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { doc_type } = req.body;
    if (!doc_type) return res.status(400).json({ error: 'doc_type required' });

    const customer = await queryOne<any>('SELECT id FROM customers WHERE id = ?', [req.params.customerId]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const id = uuidv4();
    const filepath = `/uploads/documents/${req.file.filename}`;

    await execute(`
      INSERT INTO customer_documents (id, customer_id, doc_type, original_name, filename, filepath, file_size, mime_type, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, req.params.customerId, doc_type, req.file.originalname, req.file.filename,
      filepath, req.file.size, req.file.mimetype, req.user!.id]);

    return res.status(201).json({ id, filepath, url: filepath });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/documents/:customerId', authenticate, async (req: Request, res: Response) => {
  try {
    const docs = await query<any>(`
      SELECT d.*, u.name as uploaded_by_name
      FROM customer_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.customer_id = ?
      ORDER BY d.created_at DESC
    `, [req.params.customerId]);
    return res.json(docs);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/document/:docId', authenticate, async (req: Request, res: Response) => {
  try {
    const doc = await queryOne<any>('SELECT * FROM customer_documents WHERE id = ?', [req.params.docId]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const fullPath = path.join(process.cwd(), DOCS_PATH, doc.filename);
    try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch {}

    await execute('DELETE FROM customer_documents WHERE id = ?', [req.params.docId]);
    return res.json({ message: 'Document deleted' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
