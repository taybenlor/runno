import { createConnection } from "./messaging";
import { handleParams } from "./params";
import { RunElement } from "@runno/runtime";

const runtime = document.querySelector<RunElement>("runno-run")!;

runtime.addEventListener("runno-ready", () => {
  // Set up iframe messaging connections
  createConnection(runtime).then(() => {});

  // Handle params (if there are any)
  handleParams(runtime);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service.worker.js", { scope: "/" });
}
