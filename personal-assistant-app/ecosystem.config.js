module.exports = {
  apps: [
    {
      name: "personalai-web",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "512M",
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: "personalai-worker",
      script: "npm",
      args: "run start:worker",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
