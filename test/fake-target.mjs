// Fake target used by the end-to-end test: mimics a DSH web server enough for
// the cetridr.s reachability probe and iframe embed. argv[2]=port argv[3]=name.

import { createServer } from 'node:http'

const port = Number(process.argv[2] || 3080)
const name = process.argv[3] || 'profile'

createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(
    '<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#111;color:#eee">' +
      '<h1>' + name + '</h1>' +
      '<p>fake DSH surface on port ' + port + '</p>' +
      '</body></html>',
  )
}).listen(port, '127.0.0.1', () => {
  console.log(name + ' listening on ' + port)
})

