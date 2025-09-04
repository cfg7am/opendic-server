#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

// 워커 프로세스 시작
function startWorker() {
  console.log('Starting wordbook worker server...');
  
  const serverPath = path.join(__dirname, '../server.js');
  const worker = spawn('node', [serverPath], {
    stdio: 'inherit', // 부모 프로세스의 stdio 상속
    env: process.env
  });

  worker.on('close', (code) => {
    console.log(`Worker process exited with code ${code}`);
    
    // 비정상 종료시 5초 후 재시작
    if (code !== 0) {
      console.log('Worker crashed, restarting in 5 seconds...');
      setTimeout(startWorker, 5000);
    }
  });

  worker.on('error', (error) => {
    console.error('Failed to start worker:', error);
  });

  // 그레이스풀 셧다운
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down worker...');
    worker.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down worker...');
    worker.kill('SIGTERM');
  });

  return worker;
}

// 멀티 워커 지원
const workerCount = parseInt(process.env.WORKER_COUNT) || 1;
const workers = [];

console.log(`Starting ${workerCount} worker(s)...`);

for (let i = 0; i < workerCount; i++) {
  const worker = startWorker();
  workers.push(worker);
}

console.log(`${workerCount} worker(s) started successfully`);

// 프로세스 종료시 모든 워커 정리
process.on('exit', () => {
  console.log('Cleaning up workers...');
  workers.forEach(worker => {
    if (!worker.killed) {
      worker.kill();
    }
  });
});