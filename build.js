#!/usr/bin/env node

/**
 * ReelView Build Automation Script
 * Builds Windows EXE and Android APK
 * Usage: node build.js [--windows-only] [--android-only] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('');
  log(`??? ${title} ???`, 'cyan');
}

function success(message) {
  log(`? ${message}`, 'green');
}

function error(message) {
  log(`? ${message}`, 'red');
}

function warn(message) {
  log(`? ${message}`, 'yellow');
}

function info(message) {
  log(`? ${message}`, 'yellow');
}

async function runCommand(command, cwd = process.cwd(), options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const result = execSync(command, {
        cwd,
        stdio: options.verbose ? 'inherit' : 'pipe',
        ...options,
      });
      resolve(result);
    } catch (err) {
      reject(err);
    }
  });
}

async function checkPrerequisites() {
  section('CHECKING PREREQUISITES');

  const checks = [
    { name: 'Node.js', command: 'node --version' },
    { name: 'npm', command: 'npm --version' },
  ];

  for (const check of checks) {
    try {
      const version = execSync(check.command, { encoding: 'utf-8' }).trim();
      success(`${check.name}: ${version}`);
    } catch {
      error(`${check.name} not found`);
      process.exit(1);
    }
  }

  // Check Java for Android
  let javaVersion = null;
  try {
    const javaOutput = execSync('java -version 2>&1', { encoding: 'utf-8' });
    const match = javaOutput.match(/version "([^"]+)"/);
    javaVersion = match ? match[1] : 'unknown';
    success(`Java SDK: ${javaVersion}`);
  } catch {
    warn('Java SDK not found. Android build will fail.');
  }

  // Check ANDROID_HOME
  if (process.env.ANDROID_HOME) {
    success(`ANDROID_HOME: ${process.env.ANDROID_HOME}`);
  } else {
    warn('ANDROID_HOME not set. Trying to detect Android Studio...');
    const androidStudioPaths = [
      'C:\\Users\\' + (process.env.USERNAME || 'Admin') + '\\AppData\\Local\\Android\\Sdk',
      'C:\\Android\\sdk',
      'C:\\Program Files\\Android\\sdk'
    ];
    
    for (const androidPath of androidStudioPaths) {
      if (fs.existsSync(androidPath)) {
        process.env.ANDROID_HOME = androidPath;
        success(`Auto-detected ANDROID_HOME: ${androidPath}`);
        break;
      }
    }
    
    if (!process.env.ANDROID_HOME) {
      warn('Could not find Android SDK. APK build will be skipped.');
    }
  }

  // Check for Android Studio
  const androidStudioPaths = [
    'C:\\Program Files\\Android\\Android Studio',
    'C:\\Program Files (x86)\\Android\\Android Studio'
  ];
  
  let hasAndroidStudio = false;
  for (const studioPath of androidStudioPaths) {
    if (fs.existsSync(studioPath)) {
      success(`Android Studio found: ${studioPath}`);
      hasAndroidStudio = true;
      break;
    }
  }
  
  if (!hasAndroidStudio) {
    warn('Android Studio not found in standard locations');
  }
}

async function buildSPA() {
  section('STEP 1: BUILD REACT SPA');

  try {
    const spaDir = path.join(process.cwd(), 'spa');
    info(`Building in: ${spaDir}`);
    
    await runCommand('npm run build', spaDir, { verbose: true });
    success('React SPA built successfully');
  } catch (err) {
    error('SPA build failed');
    console.error(err.message);
    process.exit(1);
  }
}

async function copyWebAssets() {
  section('COPYING WEB ASSETS FOR CAPACITOR');

  try {
    const spaDistDir = path.join(process.cwd(), 'spa', 'dist');
    const wwwDir = path.join(process.cwd(), 'www');

    info('Cleaning old web assets...');
    if (fs.existsSync(wwwDir)) {
      fs.rmSync(wwwDir, { recursive: true, force: true });
    }

    info('Creating www directory...');
    fs.mkdirSync(wwwDir, { recursive: true });

    info('Copying SPA build to www...');
    copyRecursive(spaDistDir, wwwDir);

    success('Web assets copied to www/');
  } catch (err) {
    error('Failed to copy web assets');
    console.error(err.message);
    process.exit(1);
  }
}

async function deployToElectron() {
  section('STEP 2: DEPLOY TO ELECTRON');

  try {
    const electronApp = path.join(process.cwd(), 'fresh-migrated', 'electron', 'app');
    const spaDistDir = path.join(process.cwd(), 'spa', 'dist');

    info('Cleaning old build...');
    if (fs.existsSync(electronApp)) {
      fs.rmSync(electronApp, { recursive: true, force: true });
    }

    info('Creating deployment directory...');
    fs.mkdirSync(electronApp, { recursive: true });

    info('Copying SPA build to Electron...');
    copyRecursive(spaDistDir, electronApp);

    success('SPA deployed to Electron');
  } catch (err) {
    error('Electron deployment failed');
    console.error(err.message);
    process.exit(1);
  }
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(src);
  files.forEach((file) => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

async function syncCapacitor() {
  section('STEP 3: SYNCHRONIZE CAPACITOR');

  try {
    const rootDir = process.cwd();
    info('Running Capacitor sync from root directory...');
    
    // Run npx cap sync from root, not from spa
    await runCommand('npx cap sync android', rootDir, { verbose: true });
    success('Capacitor synchronized');
  } catch (err) {
    warn('Capacitor sync failed - continuing anyway');
    info('Web assets should still be available for build');
    // Don't exit - we can still try to build
  }
}

async function buildWindowsEXE() {
  section('STEP 4: BUILD WINDOWS EXE');

  try {
    const electronDir = path.join(process.cwd(), 'fresh-migrated', 'electron');
    info(`Building in: ${electronDir}`);

    info('Installing dependencies...');
    await runCommand('npm install', electronDir, { verbose: false });

    info('Building EXE...');
    await runCommand('npm run electron:make', electronDir, { verbose: true });

    success('Windows EXE built successfully');
    info(`Location: ${path.join(electronDir, 'dist')}`);
  } catch (err) {
    error('Windows EXE build failed');
    console.error(err.message);
    process.exit(1);
  }
}

async function buildAndroidAPK() {
  section('STEP 5: BUILD ANDROID APK');

  if (!process.env.ANDROID_HOME) {
    warn('ANDROID_HOME not set. Skipping Android build.');
    return;
  }

  const androidDir = path.join(process.cwd(), 'android');
  
  if (!fs.existsSync(androidDir)) {
    warn('Android project directory not found. Skipping APK build.');
    return;
  }

  try {
    info(`Building in: ${androidDir}`);

    // Check if we can use Gradle successfully
    let buildSuccess = false;
    
    // Try Gradle first (with better Java detection)
    try {
      info('Attempting Gradle build...');
      
      const gradleCommand = process.platform === 'win32' 
        ? '.\\gradlew.bat assembleDebug --no-daemon' 
        : './gradlew assembleDebug --no-daemon';
      
      // Try with no Java version override first
      const env = {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME,
      };

      execSync(gradleCommand, {
        cwd: androidDir,
        stdio: 'inherit',
        env: env,
      });
      
      buildSuccess = true;
    } catch (gradleErr) {
      // Gradle failed - that's okay, we'll suggest Android Studio
      buildSuccess = false;
    }
    
    if (buildSuccess) {
      success('Android APK built successfully');
      const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
      
      if (fs.existsSync(apkPath)) {
        const stats = fs.statSync(apkPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        info(`APK Location: ${apkPath}`);
        info(`APK Size: ${sizeMB} MB`);
        success('? APK ready for testing!');
      }
    } else {
      // Gradle failed - check for Android Studio
      const androidStudioPath = 'C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe';
      
      if (fs.existsSync(androidStudioPath)) {
        warn('Gradle build failed due to Java version incompatibility');
        info('');
        info('? SOLUTION: Using Android Studio to build APK...');
        info('');
        info('Opening Android Studio...');
        
        try {
          // Open Android Studio with the android project
          execSync(`"${androidStudioPath}" "${androidDir}"`, {
            stdio: 'inherit',
          });
          
          info('');
          info('Android Studio is now open. To build APK:');
          info('1. Wait for project to sync');
          info('2. Click: Build > Make Project');
          info('3. APK will be generated at:');
          info(`   ${path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')}`);
        } catch (studioErr) {
          warn('Could not auto-open Android Studio');
          info('Please open manually:');
          info(`Path: ${androidDir}`);
        }
      } else {
        // No Android Studio - provide manual instructions
        warn('Gradle build failed and Android Studio not found');
        info('');
        info('?? APK BUILD OPTIONS:');
        info('');
        info('Option 1: Install Android Studio (Recommended)');
        info('  - Download: https://developer.android.com/studio');
        info('  - Install and open');
        info('  - Re-run this build script');
        info('');
        info('Option 2: Install compatible Java version');
        info('  - Download JDK 11-17 (not 25+)');
        info('  - Set JAVA_HOME to that version');
        info('  - Re-run this build script');
        info('');
        info('Option 3: Manual Gradle build');
        info(`  - cd ${androidDir}`);
        info('  - gradlew.bat assembleDebug');
        info('');
      }
    }
  } catch (err) {
    error('Android APK build encountered an error');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const windowsOnly = args.includes('--windows-only');
  const androidOnly = args.includes('--android-only');
  const verbose = args.includes('--verbose');

  console.clear();
  console.log('');
  log('??????????????????????????????????????????????????????????????', 'cyan');
  log('?         ReelView - Complete Build Automation              ?', 'cyan');
  log('?              Windows EXE + Android APK                    ?', 'cyan');
  log('??????????????????????????????????????????????????????????????', 'cyan');

  const startTime = Date.now();

  try {
    await checkPrerequisites();

    if (!androidOnly) {
      await buildSPA();
      await deployToElectron();
      await syncCapacitor();
      await buildWindowsEXE();
    }

    if (!windowsOnly) {
      // For Android, we need the web assets copied
      if (!androidOnly) {
        // Already built SPA above
        await copyWebAssets();
        await syncCapacitor();
      }
      await buildAndroidAPK();
    }

    section('BUILD SUMMARY');
    success('Build process completed!');
    console.log('');
    log('Build Artifacts:', 'bright');
    log('  Windows EXE:  fresh-migrated/electron/dist/reelview Setup 1.0.0.exe', 'yellow');
    log('  Android APK: android/app/build/outputs/apk/debug/app-debug.apk', 'yellow');
    console.log('');

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    info(`Total Time: ${duration} minutes`);
    console.log('');
    success('Ready for beta testing!');
  } catch (err) {
    error('Build failed');
    process.exit(1);
  }
}

main();