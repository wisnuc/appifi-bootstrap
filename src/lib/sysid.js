const fs = require('fs')
const child = require('child_process')

const x64 = callback => fs.stat('/proc/BOARD_io', err => {
  if (err && err.code === 'ENOENT') {
    child.exec('dmidecode -s system-serial-number', (err, stdout1) => err
      ? callback(err)
      : child.exec('dmidecode -s system-uuid', (err, stdout2) => err
          ? callback(err)
          : callback(null, { 
              arch: 'x64',
              model: 'generic', 
              serial: stdout1.toString().trim(),
              uuid: stdout2.toString().trim()
            })))
  } else if (err) {
    callback(err)
  } else {
    child.exec('dd if=/dev/mtd0ro bs=1 skip=1697760 count=11', (err, stdout) => err 
      ? callback(err)
      : callback(null, { 
          arch: 'x64',
          model: 'ws215i', 
          serial: stdout.toString().trim() 
        }))
  }
})

// not implemented TODO only armv8 is supported
const arm = callback => {
}

module.exports = process.arch === 'x64' ? x64 : arm
