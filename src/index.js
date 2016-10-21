'use strict'
var cp = require('child_process')
var http = require('http')
var crypto = require('crypto')
var xml2js = require('xml2js')
var fs = require('fs')

const bistroUrl = 'http://radining.compass-usa.com/hbo/Documents/Menus/Bistro%20Web%20Menu.pdf'

exports.handler = (event, context, callback) => {
  download(bistroUrl, (err, pdfBuffer) => {
    if (err) return callback(err)
    pdfToJson(pdfBuffer, (err, json) => {
      if (err) return callback(err)
      storeFiles(pdfBuffer, json, callback)
    })      
  })
}

function download(url, cb) {
  const req = http.get(url, res => {
    var data = []
    res.on('data', chunk => data.push(chunk))
    res.on('end', () => {
      const buffer = Buffer.concat(data)
      cb(null, buffer)
    })
  })
  req.on('error', cb)
}

function pdfToJson(pdfBuffer, cb) {
  var data = ''
  const path = '/tmp/menu.pdf'
  fs.writeFileSync(path, pdfBuffer)
  const child = cp.exec('./pdftohtml -f 1 -l 1 -i -noframes -xml -stdout ' + path, err => {
    if (err) return cb(err)
    xml2js.parseString(data, {strict:false}, (err, json) => {
      if (err) return cb(err)
      cb(null, json.PDF2XML.PAGE[0].TEXT.map(nodeToData))
    })
  })
  child.stdout.on('data', chunk => data += chunk)
  
  function nodeToData(node) {
    return {
      text: node._,
      top: Number(node.$.TOP),
      left: Number(node.$.LEFT),
      center: Number(node.$.LEFT) + (Number(node.$.WIDTH) / 2),
      height: Number(node.$.HEIGHT)
    }
  }
}

function storeFiles(pdfBuffer, json, cb) {
  const AWS = require('aws-sdk')
  const s3 = new AWS.S3({signatureVersion: 'v4'})
  
  const md5sum = crypto.createHash('md5').update(pdfBuffer).digest("hex")

  const params = {
    Bucket: 'bistro-menus',
    Key: md5sum + '.pdf',
    Body: pdfBuffer
  }

  s3.putObject(params, err => {
    params.Key = 'latest.json'
    params.Body = JSON.stringify(json)
    s3.putObject(params, cb)
  })
}

if (!module.parent) {
  download(bistroUrl, (err, pdfBuffer) => {
    var data = ''
    const path = '/tmp/menu.pdf'
    fs.writeFileSync(path, pdfBuffer)
    const child = cp.exec('pdftohtml -f 1 -l 1 -i -noframes -xml -stdout ' + path, err => {
      if (err) throw err
      console.log(data)
    })
    child.stderr.pipe(process.stderr)
    child.stdout.on('data', chunk => data += chunk)
  })
}
