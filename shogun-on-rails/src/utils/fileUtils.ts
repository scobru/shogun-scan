import fs from 'fs-extra';
import path from 'path';

/**
 * Ensure directory exists, creating it if it doesn't
 * @param dirPath The directory path to ensure
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

/**
 * Write content to a file, creating directories if they don't exist
 * @param filePath The path to the file
 * @param content The content to write
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content);
}

/**
 * Write JSON to a file, creating directories if they don't exist
 * @param filePath The path to the file
 * @param content The JSON content to write
 * @param spaces Number of spaces for indentation
 */
export async function writeJsonFile(
  filePath: string, 
  content: any, 
  spaces: number = 2
): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJSON(filePath, content, { spaces });
} 