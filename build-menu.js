#!/usr/bin/env node

/**
 * ReelView Build Menu - Interactive Build Selection
 * Usage: node build-menu.js
 */

const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${question}${colors.reset} `, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.clear();
  log('\n??????????????????????????????????????????????????????????????', 'cyan');
  log('?         ReelView - Interactive Build Menu                 ?', 'cyan');
  log('?              Windows EXE + Android APK                    ?', 'cyan');
  log('??????????????????????????????????????????????????????????????\n', 'cyan');

  const options = [
    { num: '1', label: 'Build Everything (EXE + APK)', cmd: 'node build.js' },
    { num: '2', label: 'Build Windows EXE Only', cmd: 'node build.js --windows-only' },
    { num: '3', label: 'Build Android APK Only', cmd: 'node build.js --android-only' },
    { num: '4', label: 'Build with Verbose Output', cmd: 'node build.js --verbose' },
    { num: '5', label: 'View Build Guide', cmd: 'help' },
    { num: '6', label: 'Exit', cmd: 'exit' },
  ];

  log('Select an option:\n', 'yellow');
  options.forEach((opt) => {
    log(`  ${opt.num}. ${opt.label}`, 'bright');
  });

  const choice = await askQuestion('\nEnter your choice (1-6):');

  const selected = options.find((o) => o.num === choice);

  if (!selected) {
    log('\n? Invalid selection. Please try again.', 'red');
    rl.close();
    setTimeout(() => main(), 500);
    return;
  }

  rl.close();

  if (selected.cmd === 'help') {
    try {
      const guide = fs.readFileSync('BUILD_AUTOMATION_GUIDE.md', 'utf-8');
      console.clear();
      console.log(guide);
      log('\nPress Ctrl+C to exit', 'yellow');
    } catch {
      log('\n? Build guide not found at BUILD_AUTOMATION_GUIDE.md', 'red');
    }
    return;
  }

  if (selected.cmd === 'exit') {
    log('\nGoodbye! ??\n', 'green');
    process.exit(0);
  }

  log(`\nStarting: ${selected.label}\n`, 'green');
  log('?'.repeat(60), 'cyan');

  try {
    execSync(selected.cmd, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    log('\n' + '?'.repeat(60), 'cyan');
    log('\n? Build completed successfully!\n', 'green');
  } catch (err) {
    log('\n' + '?'.repeat(60), 'cyan');
    log('\n? Build failed. See errors above.\n', 'red');
    process.exit(1);
  }
}

main();
