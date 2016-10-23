var JSZip = require("jszip");
var fs = require("fs");
var packed = false;
var buffer;
exports.pack = function(addr, cb) {
  var manifest = buildManifest();
  var zip = new JSZip();
  for(var file of manifest) {
    var path = __dirname + "/buildfiles/" + file;
    try {
      var filedata = fs.readFileSync(path);
    } catch(e) {
      console.error(file);
      process.exit();
    }
    zip.file(file, filedata);
  }
  zip.file("config.json", "{ \"main\": \"" + addr + "\" }");
  toBuffer(zip, function(buf) {
    buffer = buf;
    packed = true;
    cb();
  })
}

function buildManifest(dir, path) {
  if(path != "edge/files") {
    return [];
  }
  dir = dir || __dirname + "/buildfiles/";
  path = path || "";
  var files = fs.readdirSync(dir);
  var added = [];
  for(var i = 0; i < files.length; i++) {
    var file = files[i];
    var stat = fs.statSync(dir + file);
    if(stat.isDirectory()) {
      added = added.concat(buildManifest(dir + file + "/", path + file + "/"));
    } else {
      files[i] = path + files[i];
      added.push(files[i]);
    }
  }
  return added;
}

function toBuffer(zip, cb) {
  var bufs = [];
  zip
  .generateNodeStream({type:'nodebuffer',streamFiles:true})
  .on("data", function(d) {
    bufs.push(d);
  })
  .on("end", function() {
    cb(Buffer.concat(bufs));
  })
}

exports.get = function() {
  if(packed) {
    return buffer;
  } else {
    return false;
  }
}