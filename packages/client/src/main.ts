import { createConnection } from "./messaging";
import { handleParams } from "./params";
import { defineElements, RunElement } from "@runno/runtime";

// TODO: Figure out a way to put this into the runno library
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/service.worker.js", { scope: "/" })
    .then((reg) => {
      // TODO: Remove logging
      // registration worked
      console.log(
        "Service worker Registration succeeded. Scope is " + reg.scope
      );
      console.log(reg, reg.installing);
    })
    .catch((error) => {
      // TODO: Remove logging
      // registration failed
      console.error("Service Worker Registration failed with " + error);
      throw error;
    });
}

defineElements();

const runtime = document.querySelector<RunElement>("runno-run")!;

runtime.addEventListener("runno-ready", () => {
  // Set up iframe messaging connections
  createConnection(runtime).then(() => {});

  // Handle params (if there are any)
  handleParams(runtime);
});
