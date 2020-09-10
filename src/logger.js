function debug (msg) {
  console.log(`debug: ${msg}`)
}

function info (msg) {
  console.log(`info: ${msg}`)
}

function warning (msg) {
  console.log(`warning: ${msg}`)
}

function error (msg) {
  console.log(`error: ${msg}`)
}

function fatal (msg) {
  console.log(`fatal: ${msg}`)
}

module.exports = {
  info,
  warning,
  error,
  fatal
}
