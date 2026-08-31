module.exports = {
  apps: [
    {
      name: 'vanillaform',
      script: 'node_modules/.bin/next',
      args: 'start -p 3026 -H 0.0.0.0',
      // 설정 파일이 있는 디렉토리(=app/)를 그대로 사용한다.
      // 절대경로를 박아두면 배포 위치가 다른 서버에서 pm2 가 기동 실패한다.
      cwd: __dirname,
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
