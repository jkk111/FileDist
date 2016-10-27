var request = require("request");
var gui = require("nw.gui");
var fs = require("fs");
var downloadQueue = []
var downloadListeners = [];
var downloadsChangedListeners = [];
var downloading = false;
var activeDownload;
const home = process.env.HOME || process.env.USERPROFILE;
const dlpath = home + "/Downloads/landownloads/";

function download(file) {
  try {
    fs.mkdirSync(dlpath);
  } catch(e) {}
  var req = { path: "http://localhost/get/" + file,
              dest: dlpath + file };
  downloadQueue.push(req)
  _notifyDownloadsChanged();
  if(!downloading) {
    _download();
  }
}

function registerDownloadListener(listener) {
  downloadListeners.push(listener);
}

function registerDownloadsChangedListener(listener) {
  downloadsChangedListeners.push(listener);
  listener(downloadQueue);
}

function _notifyDownloadsChanged() {
  for(var listener of downloadsChangedListeners) {
    listener(downloadQueue);
  }
}

function _notifyDownload(state) {
  for(var listener of downloadListeners) {
    listener(state);
  }
}

function _download() {
  if(!downloadQueue[0]) {
    downloading = false;
    return;
  }
  _notifyDownload("clear");
  var req = downloadQueue[0];
  var size = 0;
  var received = 0;
  downloading = true;
  request(req.path)
  .on("response", function(response) {
    size = response.headers["content-length"];
  })
  .on("error", function(e) {
    console.log(e);
  })
  .on("end", function() {
    downloadQueue.splice(0, 1);
    _notifyDownload(1);
    _notifyDownloadsChanged();
    _download();
  })
  .on("data", function(d) {
    received += d.length;
    _notifyDownload(received / size);
  }).pipe(fs.createWriteStream(req.dest));
}