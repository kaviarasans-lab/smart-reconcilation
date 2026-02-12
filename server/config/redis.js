const Queue = require('bull');

const createQueue = (name) => {
  return new Queue(name, {
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });
};

const uploadQueue = createQueue('file-upload-processing');

module.exports = { uploadQueue, createQueue };
