module.exports = Web

var inherits = require('util').inherits
var App = require('./')

inherits(Web, App)

function Web () {
  if (!(this instanceof Web)) return new Web()
  App.call(this, document.body)

  this.on('openUrl', function (url) {
    window.open(url)
  })
}

// Start onload
window.friends = Web()
