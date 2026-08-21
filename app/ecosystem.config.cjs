module.exports = {
  apps: [
    {
      name: 'vanillaform',
      script: 'node_modules/.bin/next',
      args: 'start -p 3026 -H 0.0.0.0',
      cwd: '/home/user/vanillaform/app',
      env: {
        NODE_ENV: 'production',
        PORT: 3026,
        EXTERNAL_INTEGRATIONS_ENABLED: 'false',
        NODE_OPTIONS: '--max-old-space-size=512',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '450M',
      autorestart: true,
      min_uptime: '5s',
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
