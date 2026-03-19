// Connection config for BullMQ — uses URL string parsed into host/port
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export function getRedisConfig() {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null as null, // required for BullMQ workers
  };
}
