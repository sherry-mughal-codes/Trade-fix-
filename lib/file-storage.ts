import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function saveUploadedFile(file: File | null, folder: string) {
  if (!file || file.size === 0) return null;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = `${randomUUID()}-${sanitizeName(file.name || "attachment")}`;
  const relativePath = path.join("uploads", folder, safeName);
  const absolutePath = path.join(DATA_DIR, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return relativePath.replaceAll("\\", "/");
}

export function getStoredFileAbsolutePath(relativePath: string) {
  return path.join(DATA_DIR, relativePath);
}

export async function readStoredFile(relativePath: string) {
  return readFile(getStoredFileAbsolutePath(relativePath));
}

export function getStoredFileUrl(relativePath: string | null | undefined) {
  return relativePath ? `/api/files/${relativePath}` : null;
}
