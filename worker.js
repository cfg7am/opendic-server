require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('./models/Job');
const Wordbook = require('./models/Wordbook');
const GeminiWordAnalyzer = require('./services/geminiService');
const { v4: uuidv4 } = require('uuid');

class WorkbookWorker {
  constructor() {
    this.isRunning = false;
    this.currentJob = null;
    this.analyzer = null;
    this.workerId = `worker-${process.pid}`;
    
    // 그레이스풀 셧다운 핸들러
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
  }

  async start() {
    try {
      // MongoDB 연결
      await mongoose.connect(process.env.MONGODB_URI);
      console.log(`[${this.workerId}] MongoDB connected`);
      
      // Gemini API 초기화
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }
      
      this.analyzer = new GeminiWordAnalyzer();
      console.log(`[${this.workerId}] Gemini analyzer initialized`);
      
      this.isRunning = true;
      console.log(`[${this.workerId}] Worker started, waiting for jobs...`);
      
      // 작업 처리 루프 시작
      this.processJobsLoop();
      
      // 정기적으로 오래된 작업 정리
      setInterval(() => {
        this.cleanupOldJobs();
      }, 60 * 60 * 1000); // 1시간마다
      
    } catch (error) {
      console.error(`[${this.workerId}] Failed to start worker:`, error);
      process.exit(1);
    }
  }

  async processJobsLoop() {
    while (this.isRunning) {
      try {
        // 다음 처리할 작업 가져오기
        const job = await Job.getNextJob();
        
        if (job) {
          this.currentJob = job;
          
          await this.processJob(job);
          
          this.currentJob = null;
        } else {
          // 처리할 작업이 없으면 잠시 대기
          await this.sleep(5000); // 5초 대기
        }
      } catch (error) {
        if (this.currentJob) {
          await this.currentJob.markFailed(
            `Worker error: ${error.message}`,
            error.stack
          );
          this.currentJob = null;
        }
        
        await this.sleep(10000); // 에러 발생시 10초 대기
      }
    }
  }

  async processJob(job) {
    try {
      if (job.type !== 'wordbook_generation') {
        throw new Error(`Unknown job type: ${job.type}`);
      }

      const { wordbookName, language_category, language_label, description, words } = job.data;
      
      // 진행상황 초기화
      await job.updateProgress(0, words.length, '', '작업을 시작합니다...');
      
      // 단어 분석
      const analyzedWords = [];
      let failedWords = [];
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        try {
          // 작업이 취소되었는지 확인
          const currentJob = await Job.findById(job._id);
          if (currentJob && currentJob.status === 'cancelled') {
            return;
          }
          
          // 진행상황 업데이트
          await job.updateProgress(
            i,
            words.length,
            word,
            `분석 중: ${word} (${i + 1}/${words.length})`
          );

          // 단어 분석 (단어장 설명 전달)
          const analyzedWord = await this.analyzer.analyzeWord(word, language_category, description);
          analyzedWords.push(analyzedWord);
          
          // 20초 대기 (API Rate Limiting 방지)
          if (i < words.length - 1) {
            await this.sleep(20000);
          }
          
        } catch (error) {
          failedWords.push(word);
          
          // 실패한 단어는 fallback으로 추가
          const fallbackWord = this.analyzer.createFallbackWord(word, language_category);
          fallbackWord.meaning = `분석 실패: ${error.message}`;
          fallbackWord.tags = ["분석실패", "워커처리"];
          analyzedWords.push(fallbackWord);
        }
      }

      // 단어장 생성 단계
      await job.updateProgress(
        words.length,
        words.length,
        '',
        '단어장을 데이터베이스에 저장하는 중...'
      );

      const wordbookData = {
        wordbookId: uuidv4(),
        wordbookName,
        emoji: job.data.emoji || '📚',
        folderId: uuidv4(),
        folderName: "기본 폴더",
        language: {
          category: language_category,
          label: language_label
        },
        description: description || '',
        coverStyle: this.generateRandomGradient(),
        download_counts: 0,
        words: analyzedWords,
        wordCount: analyzedWords.length,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Worker에서는 저장하지 않고 데이터만 준비 (중복 저장 방지)
      // const newWordbook = new Wordbook(wordbookData);
      // await newWordbook.save();
      
      // 실패한 단어들 기록
      job.data.failedWords = failedWords;
      
      const completionResult = {
        totalAnalyzed: analyzedWords.length,
        successfullyAnalyzed: analyzedWords.length - failedWords.length,
        failedWords: failedWords,
        wordbookId: null // 승인 후 저장될 예정
      };

      // 완료된 단어장 데이터를 Job에 저장 (관리자 승인 대기)
      job.status = 'pending_approval';
      job.completedAt = new Date();
      job.data.analyzedWordsData = wordbookData; // 완성된 단어장 데이터 전체 저장
      job.progress.current = words.length;
      job.progress.message = '✅ 단어 분석 완료! 관리자 승인 대기 중...';
      await job.save();

      console.log(`[${this.workerId}] Job ${job.jobId} completed and waiting for approval`);
      console.log(`[${this.workerId}] Analyzed ${analyzedWords.length} words (${completionResult.successfullyAnalyzed} successful, ${failedWords.length} failed)`);

    } catch (error) {
      console.error(`[${this.workerId}] Job processing failed:`, error);
      await job.markFailed(`Processing failed: ${error.message}`, error.stack);
    }
  }

  generateRandomGradient() {
    const directions = ['to top', 'to top right', 'to right', 'to bottom right', 'to bottom', 'to bottom left', 'to left', 'to top left'];
    const colors = [
      ['#ff9a9e', '#fad0c4'], ['#a18cd1', '#fbc2eb'], ['#f6d365', '#fda085'],
      ['#84fab0', '#8fd3f4'], ['#a6c0fe', '#f68084'], ['#fccb90', '#d57eeb'],
      ['#e0c3fc', '#8ec5fc'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
      ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#6a11cb', '#2575fc']
    ];

    const direction = directions[Math.floor(Math.random() * directions.length)];
    const colorPair = colors[Math.floor(Math.random() * colors.length)];
    return `linear-gradient(${direction}, ${colorPair[0]}, ${colorPair[1]})`;
  }

  async cleanupOldJobs() {
    try {
      const cleaned = await Job.cleanupOldJobs();
      if (cleaned.deletedCount > 0) {
        console.log(`[${this.workerId}] Cleaned up ${cleaned.deletedCount} old jobs`);
      }
    } catch (error) {
      console.error(`[${this.workerId}] Failed to cleanup old jobs:`, error);
    }
  }

  async gracefulShutdown(signal) {
    console.log(`[${this.workerId}] Received ${signal}, starting graceful shutdown...`);
    
    this.isRunning = false;
    
    if (this.currentJob) {
      console.log(`[${this.workerId}] Saving current job state before shutdown...`);
      
      try {
        // 현재 작업을 pending 상태로 되돌리기 (다른 워커가 처리할 수 있도록)
        this.currentJob.status = 'pending';
        this.currentJob.startedAt = null;
        this.currentJob.workerId = null;
        this.currentJob.progress.message = '워커 재시작으로 인해 대기 중...';
        await this.currentJob.save();
        
        console.log(`[${this.workerId}] Current job saved and reset to pending`);
      } catch (error) {
        console.error(`[${this.workerId}] Failed to save current job state:`, error);
      }
    }
    
    try {
      await mongoose.connection.close();
      console.log(`[${this.workerId}] Database connection closed`);
    } catch (error) {
      console.error(`[${this.workerId}] Error closing database connection:`, error);
    }
    
    console.log(`[${this.workerId}] Graceful shutdown completed`);
    process.exit(0);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 워커 시작
if (require.main === module) {
  const worker = new WorkbookWorker();
  worker.start().catch(error => {
    console.error('Failed to start worker:', error);
    process.exit(1);
  });
}

module.exports = WorkbookWorker;