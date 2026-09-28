const { contextBridge, ipcRenderer } = require('electron');

// Google sign-in must run in the main process (a normal browser popup cannot
// complete OAuth from the app:// origin). The renderer detects this bridge and
// routes sign-in through it instead of Firebase's popup flow.
contextBridge.exposeInMainWorld('electronOAuth', {
  signIn: (opts) => ipcRenderer.invoke('google-oauth', opts)
});
