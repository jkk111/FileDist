var request = require("request");
var express = require("express");
var multer = require("multer");
var os = require("os");
var upload = multer({ dest: __dirname + "/files" });
var app = express();
var fs = require("fs");
try {
  fs.mkdirSync(__dirname + "/files");
} catch(e) {

}
app.listen(80, function() {

});
var config = require(__dirname + "/../config.json");
var localfiles;
var uploads = [];
var uploading = false;

try {
  localfiles = require(__dirname + "/files.json");
} catch(e) {
  localfiles = {};
  writeFiles();
}

var socket = require("socket.io-client")("http://" + config.main + ":8080");

socket.on("size", function(file, cb) {
  if(localfiles[file]) {
    return cb(fs.statSync(__dirname + "/files/" + file)["size"]);
  } else {
    cb(false);
  }
});

app.post("/upload", upload.single("file"), function(req, res) {
  remove(req.file.originalname);
  localfiles[req.file.originalname] = req.file.filename;
  writeFiles();
  res.send({ success: true });
  uploadFile(req.file);
});

app.get("/files", function(req, res) {
  socket.emit("files", function(files) {
    var response = {
      local: [],
      remote: []
    }
    for(var file of files) {
      if(localfiles[file]) {
        response.local.push(file);
      } else {
        response.remote.push(file);
      }
    }
    res.send(response);
  })
});

app.get("/main", function(req, res) {
  res.send(config.main);
});

function uploadFile(file, force) {
  if(uploading && !force) {
    return uploads.push(file);
  }
  uploading = true;
  var fd = {
    file: {
      value: fs.createReadStream(file.path),
      options: {
        filename: file.originalname
      }
    }
  }
  request.post({ url: "http://" + config.main + ":8080/upload", formData: fd }, function(err, data, body) {
    if(err) uploadFile(file);
    else {
      if(uploads.length > 0) {
        uploadFile(uploads.pop(), true);
      } else {
        uploading = false;
      }
    }
  })
}

socket.on("connect", function() {
  socket.emit("sync", Object.keys(localfiles));
})

app.get("/get/:file", function(req, res) {
  var file = req.params.file;
  file = localfiles[file];
  if(file) {
    res.sendFile(__dirname + "/files/" + file);
  } else {
    file = req.params.file;
    queryNodes(file, function(host) {
      if(host) {
        fetchfile(file, host, res);
      } else {
        res.status(404).send({exists: false});
      }
    });
  }
});

function queryNodes(file, cb) {
  socket.emit("fr", file, function(res) {
    cb(res);
  });
}

function fetchfile(file, host, res) {
  var ws = fs.createWriteStream(__dirname + "/files/" + file);
  host = host == "MAIN" ? config.main + ":8080" : host;
  var url = "http://" + host + "/get/" + file;
  var data = request(url);
  var error = false;
  data.on("error", function(e) {
    console.error("Unexpected error", e);
    error = true;
  });
  data.pipe(res);
  data.pipe(ws)
  .on("finish", function() {
    if(error == false) {
      remove(file);
      localfiles[file] = file;
      writeFiles();
    }
  });
}

function remove(file) {
  if(localfiles[file]) {
    try {
      fs.unlinkSync(__dirname + "/files/" + localfiles[file]);
    } catch(e) {
      console.error(e);
    }
  }
}

function writeFiles() {
  if(socket)
    socket.emit("sync", Object.keys(localfiles));
  fs.writeFileSync(__dirname + "/files.json", JSON.stringify(localfiles));
}