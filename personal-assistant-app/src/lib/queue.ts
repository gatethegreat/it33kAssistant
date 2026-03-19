import { Queue } from "bullmq";
import { getRedisConfig } from "./redis";

const QUEUE_NAME = "agent-runs";

let instance: Queue | null = null;

export function getQueue(): Queue {
  if (!instance) {
    instance = new Queue(QUEUE_NAME, {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 200, age: 86400 },
        removeOnFail: { count: 500, age: 604800 },
      },
    });
  }
  return instance;
}

export { QUEUE_NAME };
