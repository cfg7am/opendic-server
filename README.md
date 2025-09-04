# Word Storage OpenDic Worker

Background worker service for processing wordbook generation tasks.

## Overview

This is a standalone worker application that processes wordbook generation jobs from the main word-storage-opendic application. It connects to the same MongoDB database and uses the Gemini API to analyze words and create wordbooks.

## Features

- Background job processing for wordbook generation
- Gemini AI integration for word analysis
- MongoDB integration for data storage
- Graceful shutdown handling
- Multi-worker support
- Automatic job cleanup
- Error handling and recovery

## Installation

```bash
npm install
```

## Docker

### Build Docker image
```bash
docker build -t word-storage-opendic-worker .
```

### Run with Docker
```bash
docker run -d \
  --name word-storage-opendic-worker \
  -p 32756:32756 \
  --env-file .env \
  word-storage-opendic-worker
```

### Using Docker Compose
```yaml
version: '3.8'
services:
  worker:
    image: word-storage-opendic-worker:latest
    ports:
      - "32756:32756"
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - MAIN_APP_URL=${MAIN_APP_URL}
      - PORT=32756
    restart: unless-stopped
```

## Configuration

Copy `.env.example` to `.env` and update the configuration:

```bash
cp .env.example .env
```

Required environment variables:
- `MONGODB_URI`: MongoDB connection string
- `GEMINI_API_KEY`: Google Gemini API key
- `WORKER_COUNT`: Number of worker processes (default: 1)

## Usage

### Start a single worker
```bash
npm start
```

### Start worker in development mode
```bash
npm run dev
```

### Start multiple workers
```bash
npm run worker
```

### Start multiple workers in development mode
```bash
npm run worker:dev
```

## Architecture

- `worker.js`: Main worker class that processes jobs
- `models/`: Database models (Job, Wordbook)
- `services/`: External services (Gemini API)
- `scripts/`: Utility scripts for starting workers

## Job Processing

The worker processes `wordbook_generation` jobs with the following steps:

1. Connects to MongoDB and initializes Gemini API
2. Polls for pending jobs in the database
3. Analyzes each word using Gemini AI
4. Creates wordbook with analyzed words
5. Updates job status and saves results

## Environment Variables

- `MONGODB_URI`: MongoDB connection string
- `GEMINI_API_KEY`: Google Gemini API key
- `WORKER_COUNT`: Number of concurrent workers
- `NODE_ENV`: Environment (development/production)

## Graceful Shutdown

The worker supports graceful shutdown via SIGINT/SIGTERM signals:
- Saves current job state
- Closes database connections
- Exits cleanly

## Error Handling

- Failed words are saved with fallback data
- Jobs are marked as failed if processing fails
- Workers restart automatically on crash
- Old jobs are cleaned up periodically