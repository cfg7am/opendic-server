require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Job = require("./models/Job");
const WorkbookWorker = require("./worker");

const app = express();
const port = process.env.PORT || 32756;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 워커 인스턴스
let worker = null;

// MongoDB 연결
mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => {
		console.log("Worker server: MongoDB connected");

		// 워커 시작
		worker = new WorkbookWorker();
		worker.start().catch((error) => {
			console.error("Failed to start worker:", error);
		});
	})
	.catch((error) => {
		console.error("Worker server: MongoDB connection failed:", error);
		process.exit(1);
	});

// API 라우트
// POST /api/jobs - 새 작업 생성
app.post("/api/jobs", async (req, res) => {
	try {
		const { type, data } = req.body;

		if (type !== "wordbook_generation") {
			return res.status(400).json({
				error: `Unsupported job type: ${type}`,
			});
		}

		const job = new Job({
			jobId: require("uuid").v4(),
			type,
			status: "pending",
			data,
			progress: {
				current: 0,
				total: data.words ? data.words.length : 0,
				message: "작업이 큐에 추가되었습니다.",
			},
		});

		await job.save();

		console.log(
			`Job created: ${job.jobId} (${data.words ? data.words.length : 0} words)`
		);

		res.json({
			success: true,
			jobId: job.jobId,
			message: `${data.words ? data.words.length : 0}개 단어의 AI 분석 작업이 큐에 추가되었습니다.`,
			estimatedTime: Math.ceil(
				((data.words ? data.words.length : 0) * 30) / 60
			), // 분 단위
		});
	} catch (error) {
		console.error("Error creating job:", error);
		res.status(500).json({
			error: `작업 생성 중 오류가 발생했습니다: ${error.message}`,
		});
	}
});

// GET /api/jobs - 작업 목록 조회
app.get("/api/jobs", async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 20;
		const skip = (page - 1) * limit;
		const status = req.query.status;

		let query = {};
		if (
			status &&
			["pending", "running", "completed", "failed", "cancelled"].includes(
				status
			)
		) {
			query.status = status;
		}

		const jobs = await Job.find(query)
			.select(
				"jobId type status data progress error createdAt startedAt completedAt updatedAt"
			)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit);

		const total = await Job.countDocuments(query);
		const totalPages = Math.ceil(total / limit);

		// 작업 통계
		const stats = await Job.getJobStats();

		res.json({
			jobs,
			stats,
			total,
			totalPages,
			currentPage: page,
			limit,
		});
	} catch (error) {
		console.error("Error fetching jobs:", error);
		res.status(500).json({ error: error.message });
	}
});

// GET /api/jobs/:jobId - 특정 작업 조회
app.get("/api/jobs/:jobId", async (req, res) => {
	try {
		const job = await Job.findOne({ jobId: req.params.jobId });

		if (!job) {
			return res.status(404).json({ error: "작업을 찾을 수 없습니다." });
		}

		res.json(job);
	} catch (error) {
		console.error("Error fetching job:", error);
		res.status(500).json({ error: error.message });
	}
});

// POST /api/jobs/:jobId/cancel - 작업 취소
app.post("/api/jobs/:jobId/cancel", async (req, res) => {
	try {
		const job = await Job.findOne({ jobId: req.params.jobId });

		if (!job) {
			return res.status(404).json({ error: "작업을 찾을 수 없습니다." });
		}

		if (!["pending", "running"].includes(job.status)) {
			return res.status(400).json({
				error: `현재 상태(${job.status})에서는 취소할 수 없습니다.`,
			});
		}

		await job.markCancelled();
		console.log(`Job cancelled: ${job.jobId}`);

		res.json({
			success: true,
			message: "작업이 취소되었습니다.",
		});
	} catch (error) {
		console.error("Error cancelling job:", error);
		res.status(500).json({ error: error.message });
	}
});

// POST /api/jobs/:jobId/restart - 작업 재시작
app.post("/api/jobs/:jobId/restart", async (req, res) => {
	try {
		const job = await Job.findOne({ jobId: req.params.jobId });

		if (!job) {
			return res.status(404).json({ error: "작업을 찾을 수 없습니다." });
		}

		if (!["failed", "cancelled"].includes(job.status)) {
			return res.status(400).json({
				error: `현재 상태(${job.status})에서는 재시작할 수 없습니다.`,
			});
		}

		await job.restart();
		console.log(`Job restarted: ${job.jobId}`);

		res.json({
			success: true,
			message: "작업이 재시작되었습니다.",
		});
	} catch (error) {
		console.error("Error restarting job:", error);
		res.status(500).json({ error: error.message });
	}
});

// POST /api/jobs/:jobId/finalize - 작업 최종 완료 (Main 앱에서 저장 완료 후 호출)
app.post("/api/jobs/:jobId/finalize", async (req, res) => {
	try {
		const { wordbookId, finalResult } = req.body;
		const job = await Job.findOne({ jobId: req.params.jobId });

		if (!job) {
			return res.status(404).json({ error: "작업을 찾을 수 없습니다." });
		}

		// 작업 결과 업데이트
		job.result = {
			...job.result,
			...finalResult,
			wordbookId
		};
		
		// 상태가 아직 완료되지 않았다면 완료로 변경
		if (job.status !== 'completed') {
			job.status = 'completed';
			job.completedAt = new Date();
		}
		
		await job.save();
		
		console.log(`Job finalized: ${job.jobId} with wordbook ID: ${wordbookId}`);

		res.json({
			success: true,
			message: "작업이 최종 완료되었습니다.",
		});
	} catch (error) {
		console.error("Error finalizing job:", error);
		res.status(500).json({ error: error.message });
	}
});

// 건강 상태 체크
app.get("/health", (req, res) => {
	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		worker: worker ? "running" : "stopped",
	});
});

// 404 핸들러
app.use("*", (req, res) => {
	res.status(404).json({ error: "Endpoint not found" });
});

// 에러 핸들러
app.use((error, req, res, next) => {
	console.error("Server error:", error);
	res.status(500).json({ error: "Internal server error" });
});

// 서버 시작
app.listen(port, () => {
	console.log(`Worker server running on port ${port}`);
});

// 그레이스풀 셧다운
process.on("SIGINT", async () => {
	console.log("Received SIGINT, shutting down worker server...");

	if (worker) {
		await worker.gracefulShutdown("SIGINT");
	}

	try {
		await mongoose.connection.close();
		console.log("Database connection closed");
	} catch (error) {
		console.error("Error closing database connection:", error);
	}

	process.exit(0);
});

process.on("SIGTERM", async () => {
	console.log("Received SIGTERM, shutting down worker server...");

	if (worker) {
		await worker.gracefulShutdown("SIGTERM");
	}

	try {
		await mongoose.connection.close();
		console.log("Database connection closed");
	} catch (error) {
		console.error("Error closing database connection:", error);
	}

	process.exit(0);
});
