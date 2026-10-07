import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import mime from 'mime';

export interface UploadedFileWithMime {
  path: string;
  mimetype: string;
  originalname: string;
  publicUrl: string;
  category: 'image' | 'video' | 'pdf';
}

export const getFilesFromDto = async (
  fileContents: any,
  category: 'image' | 'video' | 'pdf' = 'image',
): Promise<UploadedFileWithMime[]> => {
  if (!fileContents || fileContents.length === 0) {
    return [];
  }

  const uploadsDir = path.join(process.cwd(), 'uploads', 'quiz');
  await fs.mkdir(uploadsDir, { recursive: true });

  const filePromises = fileContents.map(async (fileContent: any) => {
    const rawName = fileContent.originalname || `upload-${category}`;
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${randomUUID()}-${safeName}`;
    const filePath = path.join(uploadsDir, fileName);

    if (fileContent.buffer) {
      await fs.writeFile(filePath, fileContent.buffer);
    } else if (fileContent.path) {
      await fs.copyFile(fileContent.path, filePath);
    }

    const determinedMimeType =
      fileContent.mimetype && fileContent.mimetype !== 'application/octet-stream'
        ? fileContent.mimetype
        : mime.getType(rawName) || fileContent.mimetype || 'application/octet-stream';

    return {
      path: filePath,
      mimetype: determinedMimeType,
      originalname: rawName,
      publicUrl: `/uploads/quiz/${fileName}`,
      category,
    };
  });

  return Promise.all(filePromises);
};
