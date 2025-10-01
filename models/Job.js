const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  type: { type: String, required: true }, // 'wordbook_generation'
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'pending_approval'],
    default: 'pending'
  },
  priority: { type: Number, default: 0 }, // 높을수록 우선순위 높음
  
  // 작업 데이터
  data: {
    wordbookName: String,
    language_category: String,
    language_label: String,
    description: String,
    words: [String], // 분석할 단어 배열
    totalWords: Number,
    processedWords: { type: Number, default: 0 },
    failedWords: [String],
    
    // 결과 데이터
    wordbookId: String, // 생성된 단어장 ID
    analyzedWordsData: mongoose.Schema.Types.Mixed // 분석 완료된 단어들
  },
  
  // 진행 상황
  progress: {
    current: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    currentWord: String,
    message: String,
    estimatedTimeRemaining: Number // 초 단위
  },
  
  // 에러 정보
  error: {
    message: String,
    stack: String,
    lastFailedWord: String,
    retryCount: { type: Number, default: 0 }
  },
  
  // 시간 정보
  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date,
  updatedAt: { type: Date, default: Date.now },
  
  // 작업자 정보
  workerId: String, // 어떤 워커가 처리중인지
  
  // 설정
  config: {
    retryLimit: { type: Number, default: 3 },
    batchSize: { type: Number, default: 1 }, // 한번에 처리할 단어 수
    delayBetweenWords: { type: Number, default: 20000 } // 단어간 대기시간(ms)
  }
});

// 인덱스 생성
JobSchema.index({ status: 1, priority: -1, createdAt: 1 }); // 작업 큐 조회용
JobSchema.index({ jobId: 1 }); // 개별 작업 조회용
JobSchema.index({ createdAt: 1 }); // 정리용

// 진행률 계산 미들웨어
JobSchema.pre('save', function(next) {
  if (this.progress.total > 0) {
    this.progress.percentage = Math.floor((this.progress.current / this.progress.total) * 100);
  }
  this.updatedAt = Date.now();
  next();
});

// 정적 메서드들
JobSchema.statics = {
  // 다음 처리할 작업 가져오기
  async getNextJob() {
    return await this.findOneAndUpdate(
      { status: 'pending' },
      { 
        status: 'running',
        startedAt: new Date(),
        workerId: process.pid.toString()
      },
      { 
        sort: { priority: -1, createdAt: 1 },
        new: true 
      }
    );
  },
  
  // 실행중인 작업들 가져오기
  async getRunningJobs() {
    return await this.find({ status: 'running' }).sort({ startedAt: 1 });
  },
  
  // 완료된 작업들 정리 (7일 이상 된 것)
  async cleanupOldJobs() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return await this.deleteMany({
      status: { $in: ['completed', 'failed', 'cancelled'] },
      updatedAt: { $lt: sevenDaysAgo }
    });
  },
  
  // 작업 통계
  async getJobStats() {
    const stats = await this.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const result = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      pending_approval: 0
    };
    
    stats.forEach(stat => {
      result[stat._id] = stat.count;
    });
    
    return result;
  }
};

// 인스턴스 메서드들
JobSchema.methods = {
  // 진행상황 업데이트
  async updateProgress(current, total, currentWord = '', message = '') {
    this.progress.current = current;
    this.progress.total = total;
    this.progress.currentWord = currentWord;
    this.progress.message = message;
    
    // 예상 남은 시간 계산
    if (current > 0 && total > current) {
      const elapsedTime = Date.now() - this.startedAt.getTime();
      const avgTimePerWord = elapsedTime / current;
      const remainingWords = total - current;
      this.progress.estimatedTimeRemaining = Math.floor((avgTimePerWord * remainingWords) / 1000);
    }
    
    this.data.processedWords = current;
    return await this.save();
  },
  
  // 작업 완료 처리
  async markCompleted(wordbookId, analyzedWordsData) {
    this.status = 'completed';
    this.completedAt = new Date();
    this.data.wordbookId = wordbookId;
    this.data.analyzedWordsData = analyzedWordsData;
    this.progress.current = this.progress.total;
    this.progress.message = '작업이 완료되었습니다.';
    return await this.save();
  },
  
  // 작업 실패 처리
  async markFailed(errorMessage, errorStack = '', lastFailedWord = '') {
    this.status = 'failed';
    this.completedAt = new Date();
    this.error.message = errorMessage;
    this.error.stack = errorStack;
    this.error.lastFailedWord = lastFailedWord;
    this.progress.message = `작업이 실패했습니다: ${errorMessage}`;
    return await this.save();
  },
  
  // 작업 취소 처리
  async markCancelled() {
    this.status = 'cancelled';
    this.completedAt = new Date();
    this.progress.message = '작업이 취소되었습니다.';
    return await this.save();
  },
  
  // 작업 재시작
  async restart() {
    this.status = 'pending';
    this.startedAt = null;
    this.completedAt = null;
    this.workerId = null;
    this.progress.current = 0;
    this.progress.message = '작업을 재시작합니다.';
    this.error = {};
    return await this.save();
  }
};

module.exports = mongoose.model('Job', JobSchema);