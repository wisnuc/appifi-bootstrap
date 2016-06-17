import events from 'events'
import fs from 'fs'
import https from 'https'
import stream from 'stream'

import { describe, createUrlObject, mkdirpAsync, rimrafAsync, testTarballAsync, tarballStripInjectAsync } from './utils'

async function retrieveRedirectLink(urlString) {

  return new Promise((resolve, reject) => {

    let req = https.request(createUrlObject(urlString), res => {

      if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log(res.headers.location)
        resolve(res.headers.location)
      }
      else {
        let e = new Error(`Unexpected Http Status ${res.statusCode}`)
        e.errno = 'EHTTPSTATUS'
        resolve(describe(e, {
          when: 'retrieve tar/zip redirection, response',
          urlString,
          statusCode: res.statusCode
        }))
      }
    })
    
    req.on('error', e => 
      resolve(describe(e, {
        when: 'retrieve tar/zip redirection, request',
        urlString,
      })))

    req.end()
  })
}

async function retrieveDownloadStream(redirect) {

  return new Promise((resolve, reject) => {

    let req = https.request(createUrlObject(redirect), res => {
      if (res.statusCode === 200) {

        resolve({
          request: req,
          response: res
        })
      }
      else {
        let e = new Error(`Unexpected Http Status ${res.statusCode}`)
        e.error = 'EHTTPSTATUS'
        resolve(describe(e , {
          when: 'retrieve download stream, response',
          redirect
        }))
      }
    })
    req.on('error', e => {
      resolve(describe(e, {
        when: 'retrieve download stream, request',
        redirect 
      }))
    })
    req.end()
  })
}

class streamResponseToFile extends events {

  startTimer() {
    if (this.interval) return
    this.interval = setInterval(() => {
      if (this.bytesWritten !== this.fileStream.bytesWritten) {
        this.bytesWritten = this.fileStream.bytesWritten
        this.emit('update', this)
      }
    }, 1000)
  }

  stopTimer() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  constructor(request, response, filepath) {

    super()
    this.failed = false
    this.interval = null
    this.request = request
    this.response = response
    this.filepath = filepath

    if (response.headers['content-length'] === undefined) {
      this.contentLength = 'unknown'
    }
    else {
      this.contentLength = parseInt(response.headers['content-length'])
    }

    this.fileStream = fs.createWriteStream(this.filepath, { flags: 'w+' }) 

    this.request.on('error', e => {
      this.failed = true
      this.error = describe(e, {
        when: 'downloading request error'
      })
      this.request.abort()
    })

    this.response.on('error', e => {
      this.failed = true
      this.error = describe(e, {
        when: 'downloading response error'
      })
      this.request.abort()
    })

    this.fileStream.on('error', e => {
      this.failed = true
      this.error = describe(e, {
        when: 'downloading filestream error'
      })
      this.request.abort()
    })    
  }

  async startAsync() {
    return new Promise((resolve, reject) => {
      this.fileStream.on('close', () => {
        this.stopTimer()
        this.bytesWritten = this.fileStream.bytesWritten
        if (this.failed) {
          fs.unlink(this.filepath)
          return resolve(this.error)
        }
       
        if (typeof this.contentLength === 'number' && this.bytesWritten !== this.contentLength) {
          fs.unlink(this.filepath)
          let e = new Error('Downloaded file size mismatch')
          e.errno = -1
          return resolve(describe(e,{
            when: 'Downloaded file size mismatch',
            contentLength: this.contentLength,
            bytesWritten: this.bytesWritten 
          }))
        } 
        resolve(null)
      })
      this.startTimer()
      this.response.pipe(this.fileStream)
    })
  }
}

async function mktmpfile() {

  return new Promise(resolve => {
    fs.mkdtemp('tmp/tmp-', (err, folder) => {
      if (err) resolve(describe(err, {
        when: 'make temp dir'
      }))
      else resolve(folder + '/tmpfile') 
    })
  })
}

async function mvfile(oldpath, newpath) {

  return new Promise(resolve => 
    fs.rename(oldpath, newpath, err => resolve(err)))
}

function repackedName(release) {

  return 'appifi-' + 
    release.tag_name + '-' + 
    release.id + '-' + 
    release.target_commitish.slice(0,8) + '-' +
    (release.prerelease ? 'pre' : 'rel') + '.tar.gz' 
}

class releaseDownloader extends events {

  constructor(release) {
    super()
    this.status = 'INIT'
    this.release = release 
    this.target = 'tarballs/' + repackedName(this.release)
    this.injectPath = '.release.json' 
    this.injectData = JSON.stringify(this.release, null, '  ')
    this.error = null
    this.contentLength = null
    this.bytesWritten = null
  }

  updateStatus(newStatus) {
    this.status = newStatus
    this.emit('update', this)
  }

  fail(e) {
    this.status = 'FAILED'
    this.error = e
    return e
  }

  async startAsync() {

    let result
    this.urlString = this.release.tarball_url

    result = await mkdirpAsync('tmp')
    if (result instanceof Error) return this.fail(result)
    
    result = await mkdirpAsync('tarballs')
    if (result instanceof Error) return this.fail(result)

    result = await rimrafAsync(this.target)
    if (result instanceof Error) return this.fail(result) 

    result = await mktmpfile()
    if (result instanceof Error) return this.fail(result)
    this.tmpfile1 = result

    result = await mktmpfile()
    if (result instanceof Error) return this.fail(result)
    this.tmpfile2 = result      

    this.updateStatus('RETRIEVE_REDIRECT_LINK') 
    result = await retrieveRedirectLink(this.urlString)
    if (result instanceof Error) return this.fail(result)
    this.redirect = result

    this.updateStatus('RETRIEVE_DOWNLOAD_STREAM') 
    result = await retrieveDownloadStream(this.redirect)
    if (result instanceof Error) return this.fail(result)

    if (result.response.headers['content-length'] === undefined) {
      this.contentLength = null
    }
    else {
      this.contentLength = parseInt(result.response.headers['content-length'])
    }

    this.puller = new streamResponseToFile(result.request, result.response, this.tmpfile1)
    this.puller.on('update', puller => {
      this.bytesWritten = puller.bytesWritten
      this.emit('update', this)
    })

    this.updateStatus('DOWNLOADING') 
    result = await this.puller.startAsync()
    if (result instanceof Error) return this.fail(result)

    this.updateStatus('VERIFYING')
    result = await testTarballAsync(this.tmpfile1)
    if (result instanceof Error) {
      fs.unlink(this.tmpfile1)
      return this.fail(result)
    }

    this.bytesWritten = this.puller.bytesWritten
    this.updateStatus('REPACKING')

    result = await tarballStripInjectAsync(this.tmpfile1, this.tmpfile2,
                    this.injectPath, this.injectData)
    
    if (result instanceof Error) {
      fs.unlink(this.tmpfile1)
      fs.unlink(this.tmpfile2)
      return this.fail(result)
    }

    this.updateStatus('VERIFYING_REPACKED')
    result = await testTarballAsync(this.tmpfile2)
    if (result instanceof Error) {
      fs.unlink(this.tmpfile1)
      fs.unlink(this.tmpfile2)
      return this.fail(result)
    }

    result = await mvfile(this.tmpfile2, this.target)
    if (result instanceof Error) {
      fs.unlink(this.tmpfile1)
      fs.unlink(this.tmpfile2)
      return this.fail(result)
    }

    fs.unlink(this.tmpfile1) // file2 non-exist now
    this.status = 'SUCCESS'
    this.error = null
    return null
  }  
}

export default releaseDownloader

/**
import request from 'superagent'

const releaseUrl = 'https://api.github.com/repos/wisnuc/appifi-tarball/releases'

async function retrieveRemoteReleases() {

  return new Promise(function(resolve, reject) {
    request
      .get(releaseUrl)
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) {
          resolve(describe(err, {
            when: 'retrieve remote releases',
            url: releaseUrl 
          }))
        }
        if (!res.ok) return console.log('res not ok') // TODO
        resolve(res.body) 
      })
  })
}

async function test() {

  let releases = await retrieveRemoteReleases()
  
  let download = new releaseDownloader(releases[0])
  download.on('update', state => {
    if (state.status === 'DOWNLOADING' && state.bytesWritten) {
      console.log(`${state.bytesWritten} / ${state.contentLength}`)
    }
    else {
      console.log(state.status)
    }
  })  

  return await download.startAsync()
}

test()
  .then(r => console.log(r))
  .catch(e => console.log(e))

**/






