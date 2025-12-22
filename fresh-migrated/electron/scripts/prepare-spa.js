const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(msg) {
  const line = `[prepare-spa] ${new Date().toISOString()} - ${msg}`;
  console.log(line);
}

async function run() {
  try {
    const repoRoot = path.resolve(__dirname, '..'); // fresh-migrated/electron
    const spaDir = path.resolve(repoRoot, '..', 'spa');
    const spaDist = path.join(spaDir, 'dist');
    const targetAppDir = path.join(repoRoot, 'app');

    log(`spaDir=${spaDir}`);
    log(`spaDist=${spaDist}`);
    log(`targetAppDir=${targetAppDir}`);

    // 1) Run SPA build
    log('Running SPA build (npm run build in spa)...');
    execSync('npm run build', { cwd: spaDir, stdio: 'inherit' });

    // 2) Remove existing target and copy dist
    if (fs.existsSync(targetAppDir)) {
      log('Removing existing app directory...');
      fs.rmSync(targetAppDir, { recursive: true, force: true });
    }

    log('Copying spa/dist to electron app directory...');
    // fs.cpSync available on Node 16+, fallback to manual copy
    if (fs.cpSync) {
      fs.cpSync(spaDist, targetAppDir, { recursive: true });
    } else {
      // naive recursive copy
      const copyRecursive = (src, dest) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        fs.mkdirSync(dest, { recursive: true });
        for (const ent of entries) {
          const srcPath = path.join(src, ent.name);
          const destPath = path.join(dest, ent.name);
          if (ent.isDirectory()) copyRecursive(srcPath, destPath);
          else fs.copyFileSync(srcPath, destPath);
        }
      };
      copyRecursive(spaDist, targetAppDir);
    }

    log('SPA prepared and copied successfully.');
  } catch (err) {
    console.error('[prepare-spa] Error:', err);
    process.exit(1);
  }
}

run();
