import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Uploads klasörünü oluştur - Render için /tmp kullan
const uploadsDir = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'uploads')
  : path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Uploads directory created: ${uploadsDir}`);
}

// Multer storage konfigürasyonu
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Benzersiz dosya adı oluştur
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Dosya filtreleme
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Sadece resim dosyalarına izin ver
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Sadece JPEG, JPG ve PNG dosyaları yüklenebilir!'));
  }
};

// Multer konfigürasyonu
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Çoklu dosya yükleme için
export const uploadMultiple = upload.array('images', 5); // Maksimum 5 dosya

// Tek dosya yükleme için
export const uploadSingle = upload.single('image');