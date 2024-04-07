/* global Notification */

module.exports = window.App = App

var EventEmitter = require('events').EventEmitter

var catNames = require('cat-names')
var delegate = require('dom-delegate')
var eos = require('end-of-stream')
var githubCurrentUser = require('github-current-user')
var inherits = require('inherits')
var leveldown = require('leveldown') // browser: level-js
var levelup = require('levelup')
var subleveldown = require('subleveldown')
var richMessage = require('rich-message')
var Swarm = require('friends-swarm')
var yo = require('yo-yo')

var config = require('../config')
var util = require('./util')
var command = require('./command')
var Signature = require('./signature')
var Channels = require('./elements/channels')
var Composer = require('./elements/composer')
var Messages = require('./elements/messages')
var Status = require('./elements/status')
var Users = require('./elements/users')

inherits(App, EventEmitter)

function App (el, currentWindow) {
  var self = this
  if (!(self instanceof App)) return new App(el)
  self._notifications = 0
  self.currentWindow = currentWindow

  var db = levelup(config.DB_PATH, { db: leveldown })

  db.channels = subleveldown(db, 'channels', { valueEncoding: 'json' })
  db.aliases = subleveldown(db, 'aliases', { valueEncoding: 'json' })

  // Open links in user's default browser
  delegate(el).on('click', 'a', function (e) {
    var href = e.target.getAttribute('href')
    if (/^https?:/.test(href)) {
      e.preventDefault()
      self.emit('openUrl', href)
    } else if (/^#/.test(href)) {
      self.emit('addChannel', href)
    }
  })

  // The mock data model
  self.data = {
    peers: 0,
    username: 'Anonymous (' + catNames.random() + ')',
    channels: [],
    messages: [],
    users: [],
    activeChannel: null
  }

  var swarm = window.swarm = Swarm(subleveldown(db, 'swarm'), { maxPeers: 20 })
  var channelsFound = {}
  var usersFound = {}
  var changesOffsets = {}

  // join default channel
  swarm.addChannel('friends')

  if (githubCurrentUser.verify) githubCurrentUser.verify(onCurrentUser)
  else onCurrentUser(null, false)

  function onCurrentUser (err, verified, username) {
    if (err || !verified) self.emit('showGitHelp')
    if (err) return console.error(err.message || err)
    if (verified) {
      self.data.username = username
      swarm.sign(Signature.signer(username))

      // Re-create rich messages after we know our username, since we can now do
      // highlights correctly.
      self.data.messages = self.data.messages.map(function (message) {
        return richMessage(message, self.data.username)
      })

      render()
    }
  }

  swarm.verify(Signature.verify)

  swarm.process(function (basicMessage, cb) {
    var message = richMessage(basicMessage, self.data.username)
    var channelName = message.channel || 'friends'
    var channel = channelsFound[channelName]

    if (!channel) {
      channel = channelsFound[channelName] = {
        id: self.data.channels.length,
        name: channelName,
        active: false,
        peers: 0,
        messages: []
      }
      self.data.channels.push(channel)
      self.data.activeChannel = channel
    }

    if (!changesOffsets[channel.name]) changesOffsets[channel.name] = swarm.changes(channel.name)

    if (self.data.username && !self.isFocused()) {
      if (message.text.indexOf(self.data.username) > -1) {
        new Notification('Mentioned in #' + channel.name, { // eslint-disable-line
          body: message.username + ': ' + message.text.slice(0, 20)
        })
        self.emit('setBadge')
      }
    }

    var lastMessage = channel.messages[channel.messages.length - 1]
    if (lastMessage && lastMessage.username === message.username) {
      // Last message came from same user, so merge into the last message
      message = richMessage.mergeMessages(lastMessage, message)
    } else {
      channel.messages.push(message)
    }

    if (!message.anon && message.valid) {
      if (!usersFound[message.username]) {
        usersFound[message.username] = true
        self.data.users[message.username] = {
          avatar: message.avatar,
          blocked: false
        }

        // Add user names to available autocompletes
        self.views.composer.autocompletes.push(message.username)
      }

      // update last active time for user
      self.data.users[message.username].lastActive = message.timestamp
    }
    if (!message.anon && !message.valid) {
      message.username = 'Allegedly ' + message.username
    }

    if (changesOffsets[channel.name] <= basicMessage.change) {
      render()
      self.views.messages.scrollToBottom()
    }

    cb()
  })

  swarm.on('peer', function (p, channel) {
    var ch = channelsFound[channel]
    if (ch) ch.peers++
    self.data.peers++
    render()
    eos(p, function () {
      if (ch) ch.peers--
      self.data.peers--
      render()
    })
  })

  channelsFound.friends = {
    id: 0,
    name: 'friends',
    active: true,
    peers: 0,
    messages: []
  }

  self.data.channels.push(channelsFound.friends)
  self.data.messages = channelsFound.friends.messages
  self.data.activeChannel = channelsFound.friends

  // View instances used in our App
  self.views = {
    channels: new Channels(self),
    composer: new Composer(self),
    messages: new Messages(self),
    status: new Status(self),
    users: new Users(self)
  }

  // Initial DOM tree render
  var tree = self.render()
  el.appendChild(tree)

  function render () {
    var newTree = self.render()
    yo.update(tree, newTree)
  }

  self.on('render', render)

  self.on('selectChannel', function (channelName) {
    self.data.channels.forEach(function (channel) {
      channel.active = (channelName === channel.name)
      if (channel.active) {
        self.data.messages = channel.messages
        self.data.activeChannel = channel
        if (channel.name !== 'friends') db.channels.put(channel.name, { name: channel.name, id: channel.id })
      }
    })
    render()
    self.views.composer.focus()
    self.views.messages.scrollToBottom()
  })

  self.on('sendMessage', function (text) {
    text = text.trim()
    if (text.length === 0) return

    swarm.send({
      username: self.data.username,
      channel: self.data.activeChannel && self.data.activeChannel.name,
      text: text,
      timestamp: Date.now()
    })
  })

  self.on('executeCommand', command(self, db))

  self.on('addChannel', function (channelName) {
    if (channelName.charAt(0) === '#') channelName = channelName.substring(1)
    if (channelName.length === 0) return

    if (!channelsFound[channelName]) {
      var channel = channelsFound[channelName] = {
        name: channelName,
        id: self.data.channels.length,
        peers: 0,
        active: false,
        messages: []
      }
      self.data.channels.push(channel)
      swarm.addChannel(channelName)
      db.channels.put(channelName, {
        name: channelName,
        id: self.data.channels.length
      })
    }
    self.emit('selectChannel', channelName)
  })

  self.on('leaveChannel', function (channelName) {
    if (channelName === 'friends') return // can't leave friends for now
    db.channels.del(channelName, function () {
      var channel = channelsFound[channelName]
      if (!channel) return
      var i = self.data.channels.indexOf(channel)
      if (i > -1) self.data.channels.splice(i, 1)
      delete channelsFound[channelName]
      swarm.removeChannel(channelName)
      self.emit('selectChannel', 'friends')
      render()
    })
  })

  self.on('toggleBlockUser', function (username) {
    var user = self.data.users[username]
    if (user) user.blocked = !user.blocked
    render()
    self.views.messages.scrollToBottom(true)
  })

  self.on('resizeComposer', function (height) {
    self.views.messages.notifyComposerHeight(height)
    render()
  })

  // Update friendly "timeago" time string (once per minute)
  setInterval(function () {
    self.data.activeChannel.messages.forEach(function (message) {
      message.timeago = util.timeago(message.timestamp)
    })
  }, 60 * 1000)

  db.channels.createValueStream()
    .on('data', function (data) {
      data.messages = []
      data.peers = 0
      self.data.channels.push(data)
      channelsFound[data.name] = data
      swarm.addChannel(data.name)
    })
    .on('end', function () {
      render()
    })
}

App.prototype.render = function () {
  var self = this
  var views = self.views
  var data = self.data

  return yo`
    <div class="layout">
      <div class="sidebar">
        <div class="sidebar-scroll">
          ${views.channels.render(data.channels)}
          ${views.users.render(data.users)}
        </div>
        ${views.status.render(data.username, data.peers)}
      </div>
      <div class="content">
        ${views.messages.render(data.activeChannel, data.users)}
        ${views.composer.render(data)}
      </div>
    </div>
  `
}

App.prototype.isFocused = function () {
  if (this.currentWindow) return this.currentWindow.isFocused()
  return true
}
