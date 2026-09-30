import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import mime from 'mime';

// New interface for the return type of getFilesFromDto
export interface UploadedFileWithMime {
  path: string;
  mimetype: string;
}
export const getFilesFromDto = async (
  fileContents: any,
): Promise<UploadedFileWithMime[]> => {
  if (!fileContents || fileContents.length === 0) {
    return [];
  }

  const uploadsDir = path.join(process.cwd(), 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  const filePromises = fileContents.map(async (fileContent: any) => {
    const safeName = (fileContent.originalname || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(
      uploadsDir,
      `${randomUUID()}-${safeName}`,
    );

    if (fileContent.buffer) {
      await fs.writeFile(filePath, fileContent.buffer);
    } else if (fileContent.path) {
      await fs.copyFile(fileContent.path, filePath);
    }

    const determinedMimeType =
      (fileContent.mimetype && fileContent.mimetype !== 'application/octet-stream')
        ? fileContent.mimetype
        : mime.getType(fileContent.originalname) || fileContent.mimetype || 'application/octet-stream';

    return {
      path: filePath,
      mimetype: determinedMimeType,
    };
  });

  return Promise.all(filePromises);
};
