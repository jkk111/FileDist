var uploadListeners = [];
var uploadsChangedListeners = [];
var uploadQueue = [];
var uploading = false;
var activeUpload;

document.addEventListener("DOMContentLoaded", function() {
  document.body.addEventListener("dragover", cancel);
  document.body.addEventListener("dragenter", cancel);
  document.body.addEventListener("drop", handleFileDrop)
});

function cancel(e) {
  if(e.preventDefault) e.preventDefault();
  return false;
}

function handleFileDrop(e) {
  if(e.preventDefault) e.preventDefault();
  if(e.stopPropagation) e.stopPropagation();
  var files = e.dataTransfer.files;;
  for(var i = 0; i < files.length; i++) {
    uploadQueue.push(files[i]);
    _notifyUploadsChanged();
    if(!uploading) {
      upload();
    }
  }
  return false;
}

function registerUploadListener(listener) {
  uploadListeners.push(listener);
}

function registerUploadsChangedListener(listener) {
  uploadsChangedListeners.push(listener);
  listener(uploadQueue);
}

function _notifyUpload(state) {
  for(var listener of uploadListeners) {
    listener(state);
  }
}

function _notifyUploadsChanged() {
  for(var listener of uploadsChangedListeners) {
    listener(uploadQueue);
  }
}

function upload() {
  console.log("Uploading");
  if(!uploadQueue[0]) {
    uploading = false;
    return;
  }
  _notifyUpload("clear");
  uploading = true;
  var file = uploadQueue[0];
  activeUpload = file;
  var form = new FormData();
  form.append("file", file);
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "http://localhost/upload", true);

  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      _notifyUpload(e.loaded / e.total);
    }
  }
  xhr.onload = function() {
    uploadQueue.splice(0, 1);
    _notifyUpload(1);
    _notifyUploadsChanged();
    upload();
  }
  xhr.send(form);
}