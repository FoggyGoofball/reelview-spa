'use server';
/**
 * @fileOverview A flow for building the extension and packaging the result.
 *
 * - buildAndPackageExtension - A function that runs the build script and returns a zip archive.
 */

import { ai } from '@/ai/server';
import { z } from 'genkit';
import * as fs from 'fs/promises';
import * as path from 'path';
import JSZip from 'jszip';
import { execSync } from 'child_process';

const excludedFiles = new Set(['.DS_Store']);

async function addFilesToZip(dirPath: string, zip: JSZip, baseDir: string) {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        const zipPath = path.relative(baseDir, fullPath);

        if (excludedFiles.has(item.name)) {
            continue;
        }

        if (item.isDirectory()) {
            await addFilesToZip(fullPath, zip, baseDir);
        } else {
            try {
                 const content = await fs.readFile(fullPath);
                 zip.file(zipPath, content);
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    console.warn(`File not found, skipping: ${fullPath}`);
                } else {
                    console.error(`Failed to read file ${fullPath}: ${error.message}`);
                }
            }
        }
    }
}

const BuildAndPackageOutputSchema = z.object({
  archive: z.string().describe('A base64 encoded string of the zip archive of the dist folder.'),
  logs: z.string().describe('The logs from the build process.'),
});
type BuildAndPackageOutput = z.infer<typeof BuildAndPackageOutputSchema>;

const buildAndPackageExtensionFlow = ai.defineFlow(
  {
    name: 'buildAndPackageExtensionFlow',
    outputSchema: BuildAndPackageOutputSchema,
  },
  async () => {
    const projectRoot = process.cwd();
    const distDir = path.join(projectRoot, 'dist');
    const outDir = path.join(projectRoot, 'out');
    
    // 1. Clean up previous build artifacts
    await fs.rm(distDir, { recursive: true, force: true });
    await fs.rm(outDir, { recursive: true, force: true });

    // 2. Run the Next.js static build command for the extension
    let buildLogs = '';
    try {
        console.log("Starting extension build using 'npm run build:extension'...");
        const extensionBuildOutput = execSync('npm run build:extension', { cwd: projectRoot, encoding: 'utf8' });
        buildLogs += extensionBuildOutput;
        console.log('Extension build command finished.');
        console.log(extensionBuildOutput);
    } catch (error: any) {
        console.error('Extension build failed:', error);
        // error.stdout contains the logs from the failed command.
        const errorLogs = error.stdout || error.message;
        throw new Error(`Build process failed during 'npm run build:extension': ${errorLogs}`);
    }

    // 3. Run the script to assemble the extension files
    try {
        console.log('Assembling extension files...');
        const scriptOutput = execSync('node scripts/build-extension.js', { cwd: projectRoot, encoding: 'utf8' });
        buildLogs += '\n' + scriptOutput;
        console.log('Extension assembly complete.');
        console.log(scriptOutput);
    } catch (error: any) {
        console.error('Extension assembly script failed:', error);
        const errorLogs = error.stdout || error.message;
        throw new Error(`Build process failed during assembly script: ${errorLogs}`);
    }


    // 4. Check if dist directory exists
    try {
        await fs.access(distDir);
    } catch (error) {
        throw new Error("Build process completed, but 'dist' directory was not created.");
    }

    // 5. Zip the dist directory
    const zip = new JSZip();
    await addFilesToZip(distDir, zip, distDir);

    const archive = await zip.generateAsync({ type: 'base64' });

    return { archive, logs: buildLogs };
  }
);


export async function buildAndPackageExtension(): Promise<BuildAndPackageOutput> {
    return await buildAndPackageExtensionFlow();
}