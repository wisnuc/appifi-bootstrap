const fs = require('fs')
const EventEmitter = require('events')

const request = require('superagent') 

/**
returns {
  length: may be undefined, 'unknown', or an integer,
  bytesWritten: ws.bytesWritten, an integer
  destroy: function to destory download
}
*/
const download = (url, tmpfile, callback) => {
  let rs, ws, len
  let finished = false
  let destroyed = false 

  const destroy = () => {
    if (destroyed || finished) return
    destroyed = true
    rs.removeAllListeners('error')
    rs.removeAllListeners('response')
    rs.on('error', () => {})
    ws.removeAllListeners()
    ws.on('error', () => {})
//    rs.unpipe()
    rs.abort()
    ws.destroy()
  }

  rs = request.get(url)
  rs.on('error', err => (destroy(), callback(err)))
  rs.on('response', res => {
    if (res.header['content-length']) {
      len = parseInt(res.header['content-length'])
    } else {
      len = 'unknown'
    }
  })

  ws = fs.createWriteStream(tmpfile)
  ws.on('error', err => (destroy(), callback(err)))
  ws.on('finish', () => {
    finished = true 
    if (len && len !== 'unknown') {
      if (len === ws.bytesWritten) {
        callback(null)
      } else {
        let err = new Error('size mismatch')
        err.code = 'ESIZEMISMATCH'
        callback(err)
      }
    } else {
      callback(null)
    }
  })

  rs.pipe(ws)

  let obj = { destroy }
  Object.defineProperty(obj, 'length', { get: () => len })
  Object.defineProperty(obj, 'bytesWritten', { get: () => ws.bytesWritten })
  return obj
}

module.exports = download
