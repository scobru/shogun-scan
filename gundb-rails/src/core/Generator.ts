import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { readTemplateFile, processTemplate } from '../utils/templateUtils';
import { writeFile, writeJsonFile, ensureDirectory } from '../utils/fileUtils';
import { createNextJSHook, createNextJSProvider, createNextJSPage, enhanceGenerator } from './NextJSIntegration';

export interface GeneratorOptions {
  nextjs?: boolean;
  hardhat?: boolean;
  outputDir?: string;
  relations?: ModelRelation[];
  useBaseModel?: boolean;
}

interface Field {
  name: string;
  type: string;
}

interface ModelRelation {
  type: 'hasMany' | 'belongsTo' | 'hasOne';
  model: string;
  as?: string;
  foreignKey?: string;
}

/**
 * Parse field definition from command line
 * @param fieldStr Field definition in format name:type
 * @returns Parsed field
 */
function parseField(fieldStr: string): Field {
  const [name, type = 'string'] = fieldStr.split(':');
  return { name, type };
}

/**
 * Format the fields as TypeScript attributes
 * @param fields Array of field definitions
 * @returns String with formatted TypeScript attributes
 */
function formatAttributes(fields: Field[]): string {
  return fields.map(field => `  ${field.name}: ${field.type};`).join('\n');
}

/**
 * Format the model relations as TypeScript code
 * @param modelName Name of the model
 * @param relations Array of relation definitions
 * @returns String with formatted relation definitions
 */
function formatRelations(modelName: string, relations: ModelRelation[]): string {
  if (!relations || relations.length === 0) {
    return '';
  }

  const relationCode = relations.map(relation => {
    const options: string[] = [];
    if (relation.as) {
      options.push(`as: '${relation.as}'`);
    }
    if (relation.foreignKey) {
      options.push(`foreignKey: '${relation.foreignKey}'`);
    }
    
    const optionsStr = options.length > 0 ? `, { ${options.join(', ')} }` : '';
    return `${modelName}.${relation.type}('${relation.model}'${optionsStr});`;
  }).join('\n');

  return `\n// Define model relations\n${relationCode}`;
}

/**
 * Parse relation definition from command line
 * @param relationStr Relation definition in format type:model:as?:foreignKey?
 * @returns Parsed relation
 */
function parseRelation(relationStr: string): ModelRelation {
  const parts = relationStr.split(':');
  const type = parts[0] as 'hasMany' | 'belongsTo' | 'hasOne';
  const model = parts[1];
  
  const relation: ModelRelation = { type, model };
  
  if (parts.length > 2 && parts[2]) {
    relation.as = parts[2];
  }
  
  if (parts.length > 3 && parts[3]) {
    relation.foreignKey = parts[3];
  }
  
  return relation;
}

/**
 * Generate a model and related files
 * @param modelName Name of the model to generate
 * @param fields Array of field definitions as strings
 * @param relations Array of relation definitions as strings
 * @param options Generator options
 */
export async function generate(
  modelName: string,
  fields: string[],
  relations: string[] = [],
  options: GeneratorOptions = {}
): Promise<void> {
  try {
    // Make first letter uppercase for model name
    const ModelName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
    const modelNameLower = modelName.toLowerCase();
    
    // Parse fields
    const parsedFields = fields.map(parseField);
    const attributes = formatAttributes(parsedFields);
    
    // Parse relations
    const parsedRelations = relations.map(parseRelation);
    const relationCode = formatRelations(ModelName, parsedRelations);
    
    // Get output directory
    const outputDir = options.outputDir || process.cwd();
    
    // Create model
    console.log(chalk.blue(`Generating model: ${chalk.bold(ModelName)}`));
    
    // Create models directory if it doesn't exist
    const modelsDir = path.join(outputDir, 'models');
    await ensureDirectory(modelsDir);
    
    // Read appropriate model template
    const templateName = options.useBaseModel ? 'model-with-relations.ts.template' : 'model.ts.template';
    const modelTemplate = readTemplateFile(templateName);
    
    // Process template
    const modelContent = processTemplate(modelTemplate, {
      ModelName,
      modelNameLower,
      attributes,
      relations: relationCode
    });
    
    // Write model file
    const modelFilePath = path.join(modelsDir, `${ModelName}.ts`);
    await writeFile(modelFilePath, modelContent);
    console.log(chalk.green(`✓ Created model at ${chalk.bold(modelFilePath)}`));
    
    // Check if we should generate NextJS integration
    if (options.nextjs) {
      await generateIntegrations(ModelName, modelNameLower, outputDir, parsedFields, options);
    }
    
    console.log(chalk.green(`✓ Generation completed successfully`));
  } catch (error: any) {
    console.error(chalk.red(`❌ Generation failed: ${error.message}`));
    throw error;
  }
}

/**
 * Generate integrations for the model (NextJS, Hardhat)
 */
async function generateIntegrations(
  ModelName: string,
  modelNameLower: string,
  outputDir: string,
  fields: Field[],
  options: GeneratorOptions
): Promise<void> {
  try {
    // NextJS integration
    if (options.nextjs) {
      console.log(chalk.blue(`Generating NextJS integration for model: ${chalk.bold(ModelName)}`));
      
      // Define paths
      const hooksDir = path.join(outputDir, 'hooks', 'shogun');
      const componentsDir = path.join(outputDir, 'components', 'shogun');
      
      // Create hooks and provider
      await createNextJSHook(ModelName, hooksDir);
      await createNextJSProvider(componentsDir);
      
      // Create page
      const appDir = path.join(outputDir, 'app');
      const pagesDir = path.join(outputDir, 'pages');
      
      // Determine if using app or pages directory
      const pageBaseDir = fs.existsSync(appDir) ? 
        path.join(appDir, 'shogun') : 
        path.join(pagesDir, 'shogun');
        
      await createNextJSPage(ModelName, pageBaseDir);
    }
    
    // Hardhat integration
    if (options.hardhat) {
      await generateHardhatIntegration(ModelName, outputDir, fields);
    }
  } catch (error: any) {
    console.error(chalk.red(`❌ Integration generation failed: ${error.message}`));
    throw error;
  }
}

/**
 * Generate Hardhat integration files
 * @param ModelName Model name with capitalized first letter
 * @param outputDir Output directory
 * @param fields Array of parsed fields
 */
async function generateHardhatIntegration(
  ModelName: string,
  outputDir: string,
  fields: Field[]
): Promise<void> {
  console.log(chalk.blue(`Generating Hardhat integration for model: ${chalk.bold(ModelName)}`));
  
  try {
    // For now we only implement a placeholder for hardhat integration
    console.log(chalk.yellow(`⚠️ Hardhat integration is not yet implemented`));
    
  } catch (error: any) {
    console.error(chalk.red(`❌ Hardhat integration failed: ${error.message}`));
    throw error;
  }
}
