const child = require('child_process')
const UUID = require('uuid')
const sysid = require('./sysid')

/** test
  let tmp001 = "VMware-56 4d 6d 71 82 d1 fe a9-63 e4 03 75 4e d5 34 7a"
  let tmp002 = "564D6D71-82D1-FEA9-63E4-03754ED5347A"

  console.log(`sanitize "${tmp001}" to ${sanitize(tmp001)}`)
  console.log(`sanitize "${tmp002}" to ${sanitize(tmp002)}`)
**/



const sanitize = (string) => {
  if (string.startsWith('VMware-')) {
    let sub = string.slice(7).replace('-', ' ').split(' ').join('')
    if (/^[0-9a-fA-F]{32}$/.test(sub))
      string = sub 
  }

  return string.split('').filter(c => /^[A-Za-z0-9]$/.test(c)).join('') 
}

const hostname = err => {

  sysid((err, id) => {
    let hostname
    if (err)
      hostname = `wisnuc-tmp-${UUID.v4()}`
    else {

      let { model, serial, uuid } = id
      serial = sanitize(serial)
      if (uuid) uuid = sanitize(uuid)

      if (typeof serial === 'string' && serial.length >= 8)
        hostname = `wisnuc-${model}-${serial}`
      else if (typeof uuid === 'string' && uuid.length >= 8)
        hostname = `wisnuc-${model}-${uuid.slice(0, 8)}`
      else
        hostname = `wisnuc-tmp-${sanitize(UUID.v4()).slice(0, 8)}`
    }

    child.exec(`avahi-set-host-name ${hostname}`, err => {
      console.log(`avahi set hostname to ${hostname}`)
    })
  })
}

module.exports = hostname

