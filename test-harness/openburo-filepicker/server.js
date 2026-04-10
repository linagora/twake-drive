const { createServer } = require('node:http')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const html = readFileSync(join(__dirname, 'index.html'), 'utf8')

const PORT = 8089

createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('not found')
}).listen(PORT, () => {
  console.log(`OpenBuro test harness: http://localhost:${PORT}`)
})
