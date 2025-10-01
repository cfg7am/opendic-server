require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');

async function clearPendingApprovals() {
  try {
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    // pending_approval 상태인 Job 찾기
    const pendingJobs = await Job.find({ status: 'pending_approval' });
    console.log(`Found ${pendingJobs.length} jobs in pending_approval status`);

    if (pendingJobs.length === 0) {
      console.log('No jobs to update');
      process.exit(0);
    }

    // 모두 completed로 변경
    const result = await Job.updateMany(
      { status: 'pending_approval' },
      {
        $set: {
          status: 'completed',
          'progress.message': '✅ 작업이 완료되었습니다 (기존 DB 저장 완료)'
        }
      }
    );

    console.log(`Updated ${result.modifiedCount} jobs to completed status`);
    console.log('Done!');

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearPendingApprovals();
