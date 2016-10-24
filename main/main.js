var http = require("http");
var express = require("express");
var app = express();
var request = require("request");
var multer  = require('multer');
var packer = require("./packer.js");
var upload = multer({ dest: __dirname + '/files/' })
app.use(require("../common.js"));
var server = http.createServer(app).listen(process.env.port || 8080);
var io = require("socket.io")(server);
var fs = require("fs");
var os = require("os");
try {
  fs.mkdirSync(__dirname + "/files");
} catch(e) {
  
}

var files;
try {
  files = require(__dirname + "/files.json");
} catch(e) {
  files = {};
  writeFiles();
}

var clients = {

}

var remotefiles = {

}

app.get("/interfaces", function(req, res) {
  res.send(os.networkInterfaces());
});

app.get("/build/:address", function(req, res) {
  packer.pack(req.params.address, function() {
    res.send({ done: true });
  });
});

app.get("/join", function(req, res) {
  var join = packer.get();
  if(join) {
    res.set({
      'Content-disposition': 'attachment; filename=edge.zip'
    })
    res.send(join);
  } else {
    res.send("Error not initialized yet, ask host to fix this");
  }
})

app.post("/upload", upload.single("file"), function(req, res) {  
  if(files[req.file.originalname]) {
    try {
      fs.unlinkSync(__dirname + "/files/" + files[req.file.originalname]);
    } catch(e) {

    }
  }
  files[req.file.originalname] = req.file.filename;
  writeFiles();
  res.send({ success: true });
});

app.get("/get/:file", function(req, res) {
  var file = req.params.file
  if(files[file]) {
    res.sendFile(__dirname + "/files/" + files[file]); 
  } else {
    res.status(404).send({ exists: false });
  }
});

function buildRemote(id, files) {
  for(var file of files) {
    remotefiles[file] = remotefiles[file] || {};
    remotefiles[file][id] = remotefiles[file][id] || 0;
  }
}

function writeFiles() {
  fs.writeFileSync("files.json", JSON.stringify(files))
}

io.on("connection", function(socket) {
  clients[socket.id] = {
    id: socket.id,
    socket: socket,
    files: []
  };

  socket.on("sync", function(list) {
    clients[socket.id].files = list;
    buildRemote(socket.id, list);
  });

  socket.on("fr", function(file, cb) {
    search(file, function(host) {
      cb(host);
    });
  });

  socket.on("size", function(file, cb) {
    if(files[file]) {
      cb(fs.statSync(__dirname + "/files/" + files[file])["size"]);
    } else if(remotefiles[file]) {
      for(var id in remotefiles[file]) {
        clients[id].socket.emit("size", file, function(size) {
          return cb(size);
        });
        return;
      }
    } else {
      cb(false);
    }
  });

  socket.on("files", function(cb) {
    var allfiles = Object.keys(files);
    for(var file in remotefiles) {
      if(allfiles.indexOf(file) == -1) {
        allfiles.push(file);
      }
    }
    cb(allfiles);
  });

  socket.on("disconnect", function() {
    for(var file of clients[socket.id].files) {
      var f = remotefiles[file];
      delete f[socket.id];
      if(Object.keys(f).length == 0) {
        delete clients[socket.id].files[file];
      }
    }
    delete clients[socket.id];
  });

});

function getAddr(id) {
  return "[" + clients[id].socket.request.connection.remoteAddress + "]";
}

function search(file, cb) {
  if(remotefiles[file]) {
    var minid;
    var min = Number.MAX_SAFE_INTEGER;
    for(var client in remotefiles[file]) {
      if(remotefiles[file][client] < min) {
        minid = client;
        min = remotefiles[file][client];
      }
    }
    remotefiles[file][minid]++;
    return cb(getAddr(minid));
  }
  if(files[file]) {
    cb("MAIN");
  } else {
    cb(false);
  }
}