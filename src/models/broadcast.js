const child = require('child_process')
const sysid = require('../lib/sysid')


const sanitize = string => {

  if (string.startsWith('VMware-')) {
    let sub = string.slice(7).replace('-', ' ').split(' ').join('')
    if (/^[0-9a-fA-F]{32}$/.test(sub))
      string = sub 
  }
  return string.split('').filter(c => /^[A-Za-z0-9]$/.test(c)).join('') 
}


class Broadcast {

  constructor () {
  
    this.child = child.spawn( 
  }
}

