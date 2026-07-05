const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const port = parseInt(process.env.PORT || '3002', 10)
const app = next({ dev: false })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  })

  server.listen(port, () => {
    if (process.send) process.send('ready')
  })

  process.on('SIGINT', () => {
    server.close(() => process.exit(0))
  })
})
