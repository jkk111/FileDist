document.addEventListener("keypress", function(e) {
  if(e.code == "KeyR" && e.ctrlKey) {
    window.location.reload();
  }
})