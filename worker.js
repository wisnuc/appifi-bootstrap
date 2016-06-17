import https from 'https'
import fs from 'fs'
import child from 'child_process'

import request from 'superagent'
import rimraf from 'rimraf'
import { createStore, combineReducers } from 'redux'

import releaseDownloader from 'lib/releaseDownloader'
import { describe, parseJSON, mkdirpAsync, readdirAsync, 
  readFileAsync, rimrafAsync, testTarballAsync, probeTarballs, probeAppifi,
  retrieveReleasesAsync, extractTarballAsync, tagValue } from 'lib/utils'

const releasesUrl = 'https://api.github.com/repos/wisnuc/appifi-tarball/releases'
const currentReleaseFile = 'appifi/appifi-master/release.json'

const tarballsDir = 'tarballs'
const tmpFolder = 'tmp'
const workingFolder = 'appifi'

const defaultCurrentState = {
  id : null,
  process: null,
  code: null,
  signal: null
}

const current = (state = defaultCurrentState, action) => {

  switch(action.type) {
  case 'CURRENT_DEPLOYED':
    return { 
      id: action.data.id,
      process: null,
      code: null,
      signal: null
    }

  case 'CURRENT_UNDEPLOYED':
    return defaultCurrentState

  case 'CURRENT_STARTED':
    return Object.assign({}, state, { 
      process: action.data,
      code: null,
      signal: null
    })

  case 'CURRENT_STOPPED':
    return Object.assign({}, state, {
      process: null,
      code: action.data.code ? action.data.code : null,
      signal: action.data.signal ? action.data.signal : null
    })

  default:
    return state
  }
}

const locals = (state = [], action) => {

  let r
  console.log(action)

  switch(action.type) {
  case 'LOCALS_UPDATE':
    return action.data

  case 'LOCAL_DELETE':
    return [...state.slice(0, action.data), ...state.slice(action.data+1)]

  case 'LOCAL_ADD':
    r = [...state, action.data].sort((a, b) => 
      tagValue(b.release.tag_name) - tagValue(a.release.tag_name))
    console.log(r)
    return r
  
  default:
    return state
  }
}

const remotes = (state = [], action) => {

  switch(action.type) {
  case 'REMOTES_UPDATE':
    return action.data

  default:
    return state
  }
}

const downloads = (state = [], action) => {

  switch(action.type) {
  case 'DOWNLOAD_START': { 
    let index = state.findIndex(d => d.release.id === action.data.release.id)
    if (index === -1) {
      return [...state, action.data]
    }
    return [...state.slice(0, index), ...state.slice(index + 1), action.data]
  }
 
  default:
    return state
  }
}

let store = createStore(combineReducers({current, locals, remotes, downloads}))
let status = 0

store.subscribe(() => { status++ })

const dispatch = (action) => store.dispatch(action)

function startAppifi() {

  let node_path = '/usr/local/bin/node'
  let appifi_path = __dirname + '/appifi'
  let babel_path = appifi_path + '/node_modules/.bin/babel-node'
  let www_path = appifi_path + '/bin/www'

  console.log(appifi_path)
  console.log(babel_path)
  console.log(www_path)

  let appifi = child.spawn('node', [babel_path, www_path], { 
    cwd: appifi_path,
    env: Object.assign(Object.create(process.env), {NODE_PATH:appifi_path}),
  })
  // let appifi = child.spawn('npm', ['start'], {cwd: appifi_path})

  appifi.on('exit', (code, signal) => {
    console.log(`appifi exited with code ${code} and signal ${signal}`)
    dispatch({
      type: 'CURRENT_STOPPED',
      data: { code, signal }
    }) 
  })

  console.log(`appifi started as ${appifi.pid}`)
  dispatch({ 
    type: 'CURRENT_STARTED', 
    data: appifi  
  })
}

// This function probe tarballs first,
// then probe appifi
// 1) if appifi not installed, extract latest release and start it
// 2) if appifi deployed but not in locals, remove it and goto 1)
// 3) if appifi deployed and in locals, start it
async function probeTarballAndStartAppifi() {

  let r = await probeTarballs('tarballs')
  if (r instanceof Error) return 
  dispatch({type: 'LOCALS_UPDATE', data: r})
  let locals = r
  console.log(`${locals.length} locals found`)
  
  r = await probeAppifi()
  if (r instanceof Error) {
    console.log(`appifi not found, rimraf anyway`)
    await rimrafAsync('appifi')
    r = null
  }

  if (r && locals.find(l => l.release.id === r.id)) {
    console.log(`appifi found deployed, with release id ${r.id}`)
    dispatch({type: 'CURRENT_DEPLOYED', data: r })
    startAppifi()
    return null
  }

  if (r) {
    console.log(`appifi found deployed but not in locals, with release id ${r.id}`)
    r = await rimrafAsync('appifi')
    if (r instanceof Error) return r
    console.log(`polluted appifi removed`)
  }

  if (locals.length === 0) return null
  r = await extractTarballAsync(locals[0].path, 'appifi') 
  if (r instanceof Error) return r
  dispatch({type: 'CURRENT_DEPLOYED', data: locals[0].release})
  console.log(`appifi deployed with release id ${locals[0].release.id}`) 
  startAppifi()
  return null
}

async function init() {

  let r

  await rimrafAsync('tmp')
  await mkdirpAsync('tmp')
  await mkdirpAsync('tarballs')

  console.log(`first trial of probing tarballs and start appifi`)
  await probeTarballAndStartAppifi()  

  console.log(`retrieving remote releases`)
  r = await retrieveReleasesAsync(releasesUrl) 
  if (!(r instanceof Error)) { 
    dispatch({ type: 'REMOTES_UPDATE', data: r })
    console.log(`${r.length} remotes found`)

/** NO auto install for debugging

    let locals = store.getState().locals
    if (locals.length === 0) {

      let download = new releaseDownloader(r[0])
      download.on('update', state => console.log(state.status))

      r = await download.startAsync() 
      if (!(r instanceof Error)) {
        r = probeTarballAndStartAppifi()
      }
    } 
**/
  }

  if (r instanceof Error) return r
  return 'successfully initialized'
}

const getCurrentState = () => {

  let current = store.getState().current
  let process = current.process ? current.process.pid : null
  return Object.assign({}, current, { process })
}

const getDownloadStates = () => {
  
  return store.getState().downloads.map(down => {
    return {
      id: down.release.id,
      status: down.status,
      bytesWritten: down.bytesWritten,
      contentLength: down.contentLength
    }
  })
}

const getState = () => {

  let state = store.getState()
  return Object.assign({}, state, {
    status,
    current: getCurrentState(),
    downloads: getDownloadStates()
  })
}

const getStatus = () => { return { status }}

async function downloadAndUpdateLocals(release) {

  const desc = (e) => 
    describe(e, {
      when: 'downloadAndUpdateLocals',
      release
    })

  let download = new releaseDownloader(release)
  download.on('update', d => dispatch({ type: 'TRIGGER' })) 
  dispatch({ type: 'DOWNLOAD_START', data: download })

  let r = await download.startAsync()
  if (r instanceof Error) return desc(r)

  dispatch({ type: 'LOCAL_ADD', data: {
    path: download.target,
    release
  }})

  return `id: ${release.id} tag: ${release.tag_name} successfully downloaded` 
}

async function deleteOp(id) {

  let r, {current, locals, remotes, downloads} = store.getState()

  if (id === current.id)
    return `Error: ${id} is installed`
  let index = locals.findIndex(l => l.release.id === id)
  if (index === -1)
    return `Error: ${id} not found in locals`

  await rimrafAsync(locals[index].path) 
  dispatch({type: 'LOCAL_DELETE', data: index})
  return 'deleted'
}

async function installOp(id) {

  let r, {current, locals, remotes, downloads} = store.getState()

  if (current.process) 
    return 'Error: appifi is running'

  if (current.id)
    return 'Error: already installed'

  r = locals.find(l => l.release.id === id)
  if (!r) return `Error: release id ${id} not found`

  let local = r

  r = await extractTarballAsync(local.path, 'appifi') 
  if (r instanceof Error) {
    r = describe(r, { 
      when: 'installOp', 
      local
    }) 
    console.log(r)
    return 'Error: extracting tarball failed'
  }

  dispatch({type: 'CURRENT_DEPLOYED', data: local.release})
  console.log(`appifi deployed with release id ${local.release.id}`) 

  return 'successfully installed'
}

async function uninstallOp() {

  let {current, locals, remotes, downloads} = store.getState()

  if (current.process)
    return 'Error: appifi is running'
  if (!current.id)
    return 'Error: not installed'

  await rimrafAsync('appifi')
  dispatch({type: 'CURRENT_UNDEPLOYED'})

  console.log(`appifi uninstalled`)
  return 'successfully uninstalled'
}

function operation(data, callback) {

  let {current, locals, remotes, downloads} = store.getState()

  const m = (msg) => callback(null, {message: msg})

  console.log(data.operation)
  switch(data.operation) {

  case 'DOWNLOAD': {
    if (locals.find(l => l.release.id === data.id))
      return m('Error: already downloaded')
    if (downloads.find(d => d.id === data.id))
      return m('Error: already downloading')

    let r = remotes.find(r => r.id === data.id)
    if (!r)
      return m(`Error: release id ${id} not found`)

    downloadAndUpdateLocals(r)
      .then(r => console.log(r))
      .catch(e => console.log(e))
    return m('download started')
  }

  case 'DELETE': {
    deleteOp(data.id)
      .then(r => callback(null, {message: r}))
      .catch(e => {
        console.log(e)
        callback(e)
      })
    return
  }

  case 'INSTALL':
    installOp(data.id)
      .then(r => callback(null, {message: r}))
      .catch(e => callback(e))  
    return

  case 'UNINSTALL':
    uninstallOp()
      .then(r => callback(null, {message: r}))
      .catch(e => callback(e))
    return

  case 'STOP_APPIFI':
    if (!current.id)
      return callback(null, {message: 'Error: appifi not installed'})
    if (!current.process) {
      return callback(null, {message: 'WARNING: appifi is not running'})
    }
    process.kill(current.process.pid + 5)
    return callback(null, {message: 'appifi stopped'})

  case 'START_APPIFI':
    if (!current.id) 
      return callback(null, {message: 'Error: appifi not installed'})
    if (current.process) 
      return callback(null, {message: 'Error: appifi is already running'})
    startAppifi()
    return callback(null, {message: 'appifi started'})
 
  default:
    return callback(null, {message: `ERROR: ${data.operation} not implemented`})
  }
}

export default { init, getState, getStatus, operation }








