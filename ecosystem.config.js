// ecosystem.config.js — Configuración de PM2 para producción
// Cluster mode: usa todos los vCPU disponibles del VPS.
// connection_limit en DATABASE_URL debe dividirse por número de instancias.
// Ejemplo VPS 4 vCPU, MySQL max_connections=200: connection_limit=40 (200/4 - reserva)

module.exports = {
  apps: [
    {
      name: 'cf',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 30000,
      kill_timeout: 5000,
      max_memory_restart: '800M',
      node_args: '--max-old-space-size=768',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      exp_backoff_restart_delay: 100,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
