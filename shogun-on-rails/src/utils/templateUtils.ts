import fs from 'fs-extra';
import path from 'path';

/**
 * Read a template file from the templates directory
 * @param templateName The name of the template file
 * @returns The content of the template file
 */
export function readTemplateFile(templateName: string): string {
  const templatePath = path.join(__dirname, '..', 'templates', templateName);
  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * Process a template string with replacements
 * @param template The template string
 * @param replacements Object with key-value pairs to replace in the template
 * @returns The processed template
 */
export function processTemplate(template: string, replacements: Record<string, string>): string {
  let result = template;
  Object.entries(replacements).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  });
  return result;
} 