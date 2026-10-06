const { createServer } = require('http')

const requests = []
const bytes = Buffer.from([0, 255, 128, 42])
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://fixture')
  const path = url.pathname
  if (path === '/requests') {
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify(requests))
    return
  }
  requests.push({
    path,
    authorization: request.headers.authorization || null,
    cookie: request.headers.cookie || null,
    userAgent: request.headers['user-agent'] || null,
    hasExpectedSignature: url.searchParams.get('signature') === 'test+value%'
  })
  // No CORS headers: only the Stack, not the browser, should read this source.
  response.setHeader('Content-Type', 'text/plain')
  if (path === '/redirect') {
    response.writeHead(302, { Location: '/bytes' })
    response.end()
  } else if (path === '/missing') {
    response.writeHead(404)
    response.end('source failure body must not reach the caller')
  } else if (path === '/no-content') {
    response.writeHead(204)
    response.end()
  } else if (path === '/chunked') {
    response.write(bytes.subarray(0, 2))
    setImmediate(() => response.end(bytes.subarray(2)))
  } else if (path === '/slow-headers') {
    // The Stack's HTTP timeout expires before this handler sends headers.
  } else if (path === '/slow-body') {
    response.writeHead(200)
    response.flushHeaders()
  } else {
    response.end(bytes)
  }
})
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`http://127.0.0.1:${server.address().port}\n`)
})
process.stdin.resume()
process.stdin.on('end', () => {
  server.closeAllConnections()
  server.close(() => process.exit(0))
})
