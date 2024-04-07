#!/usr/bin/env node

var os = require('os')
var pkgjson = require('./package.json')
var path = require('path')
var sh = require('shelljs')

var appVersion = pkgjson.version
var appName = pkgjson.name
var electronPackager = path.join('node_modules', '.bin', 'electron-packager')
var electronVersion = pkgjson.devDependencies['electron-prebuilt']
var icon = path.join('static', 'Icon.icns')

if (process.argv[2] === '--all') {
  // build for all platforms
  var archs = ['ia32', 'x64']
  var platforms = ['linux', 'win32', 'darwin']

  platforms.forEach(function (plat) {
    archs.forEach(function (arch) {
      pack(plat, arch)
    })
  })
} else {
  // build for current platform only
  pack(os.platform(), os.arch())
}

function pack (plat, arch) {
  var prefix = os.platform() === 'win32' ? '.\\' : './'
  var rimraf = path.join('node_modules', '.bin', 'rimraf')
  var outputPath = path.join('pkg', appVersion, plat, arch)

  // there is no darwin ia32 electron
  if (plat === 'darwin' && arch === 'ia32') return

  var cmd1 = `${prefix}${rimraf} ${outputPath}`
  var cmd2 = `${prefix}${electronPackager} . ${appName} ` +
    `--platform=${plat} ` +
    `--arch=${arch} ` +
    `--version=${electronVersion} ` +
    `--app-version=${appVersion} ` +
    `--icon=${icon} ` +
    `--out=${outputPath} ` +
    '--prune ' +
    '--ignore=pkg' // ignore the pkg directory or hilarity will ensue

  console.log(`${cmd1}\n${cmd2}`)

  if (process.argv.slice(2)[0] === '--dry') process.exit(0)

  sh.exec(cmd1)
  sh.exec(cmd2)
}
