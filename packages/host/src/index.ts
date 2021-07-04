import { ParentHandshake, WindowMessenger } from "post-me";

// Create the child window any way you like (iframe here, but could be popup or tab too)
const childFrame = document.createElement("iframe");
const childWindow = childFrame.contentWindow!;

// For safety it is strongly adviced to pass the explicit child origin instead of '*'
const messenger = new WindowMessenger({
  localWindow: window,
  remoteWindow: childWindow,
  remoteOrigin: "*",
});

ParentHandshake(messenger).then((connection) => {
  console.log("made connection", connection);
  /* ... */
});
