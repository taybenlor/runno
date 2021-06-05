// Wasm Module (Package) Manager for the shell
import table from "text-table";
import * as idbKeyval from "idb-keyval";
import { fetchCommandFromWAPM } from "./query";
import { extractContents } from "@wasmer/wasmfs/lib/tar";
import { lowerI64Imports } from "@wasmer/wasm-transformer";

var COMPILED_MODULES = {};
// const WAPM_COMMAND_GRAPHQL_QUERY = `query shellGetCommandQuery($command: String!) {
//   command: getCommand(name: $command) {
//     packageVersion 
//       package {
//         displayName
//       }
//       modules {
//         name
//         publicUrl
//         abi
//       }
//       version
//       commands {
//         command
//         module {
//           name
//           publicUrl
//           abi
//         }
//       }
//     }
//   }
// }`;

const WAPM_PACKAGE_QUERY = `query shellGetPackageQuery($name: String!, $version: String) {
  packageVersion: getPackageVersion(name: $name, version: $version) {
    version
    package {
      name
      displayName
    }
    filesystem {
      wasm
      host
    }
    distribution {
      downloadUrl
    }
    modules {
      name
      publicUrl
      abi
    }
    commands {
      command
      module {
        name
        abi
        source
      }
    }
  }
}
`;

const STORAGE_KEY = "WAPM_STORAGE";

const execWapmQuery = async (query, variables) => {
  const fetchResponse = await fetch("https://registry.wapm.io/graphql", {
    method: "POST",
    mode: "cors",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      // operationName: "shellGetCommandQuery",
      query,
      variables
    })
  });
  const response = await fetchResponse.json();
  if (response && response.data) {
    return response.data;
  }
};

const getBinaryFromUrl = async url => {
  const fetched = await fetch(url);
  const buffer = await fetched.arrayBuffer();
  return new Uint8Array(buffer);
};

// const getWAPMPackageFromCommandName = async commandName => {
//   let data = await execWapmQuery(WAPM_COMMAND_GRAPHQL_QUERY, {
//     command: commandName,
//   });
//   if (data && data.command && data.command.packageVersion) {
//     return data.command.packageVersion;
//   } else {
//     throw new Error(`command not found ${commandName}`);
//   }
// };

const getWAPMPackageFromPackageName = async packageName => {
  let version;
  if (packageName.indexOf("@") > -1) {
    const splitted = packageName.split("@");
    packageName = splitted[0];
    version = splitted[1];
  }
  let data = await execWapmQuery(WAPM_PACKAGE_QUERY, {
    name: packageName,
    version: version
  });
  if (data && data.packageVersion) {
    return data.packageVersion;
  } else {
    throw new Error(`Package not found in the registry ${packageName}`);
  }
};

const getWasmBinaryFromUrl = async url => {
  const fetched = await fetch(url);
  const buffer = await fetched.arrayBuffer();
  return new Uint8Array(buffer);
};

export default class WAPM {
  constructor(wasmTerminal, wasmFs) {
    // Clear the cache. Can be very big.
    idbKeyval.clear();
    this.wasmTerminal = wasmTerminal;

    this.wapmInstalledPackages = [];
    this.wapmCommands = {};
    this.uploadedCommands = {};
    this.cachedModules = {};
    this.wasmFs = wasmFs;

    // Launch off an update request to our storage
    this._updateFromStorage();
    this.callbackCommands = {
      wapm: this._wapmCallbackCommand.bind(this),
    };

    // Create a hidden input on the page for opening files
    const hiddenInput = document.createElement("input");
    hiddenInput.id = "hidden-file-input";
    hiddenInput.classList.add("hidden-file-input");
    hiddenInput.setAttribute("type", "file");
    hiddenInput.setAttribute("accept", ".wasm");
    hiddenInput.setAttribute("hidden", true);
    hiddenInput.addEventListener(
      "change",
      this._onHiddenInputChange.bind(this)
    );
    document.body.appendChild(hiddenInput);
    this._hiddenInput = hiddenInput;

    // A variable for resolving file input
    this.currentInstallResolver = undefined;
  }

  async regenerateWAPMCommands() {
    this.wapmCommands = {};
    for (let packageVersion of this.wapmInstalledPackages) {
      for (let command of packageVersion.commands) {
        if (command.module.abi === "wasi") {
          let commandUrl = command.module.publicUrl;
          this.wapmCommands[command.command] = await this.fetchBinary(
            commandUrl
          );
        }
      }
    }
  }
  async fetchBinary(binaryUrl) {
    if (!(binaryUrl in this.cachedModules)) {
      this.cachedModules[binaryUrl] = await getWasmBinaryFromUrl(binaryUrl);
    }
    return this.cachedModules[binaryUrl];
  }

  // Check if a command is cached
  isCommandCached(commandName) {
    const cachedCommand = this._getCachedCommand(commandName);
    return cachedCommand !== undefined;
  }

  // Get a command from the wapm manager
  async runCommand(options) {
    let commandName = options.args[0];
    
    // We convert the `wasmer run thecommand ...` to `thecommand ...`
    if (commandName == "wasmer") {
      if (options.args[1] == "run") {
        options.args = options.args.slice(2);
      }
      else {
        options.args = options.args.slice(1)
      }
      commandName = options.args[0];

      // This fixes the issue when doing `wasmer abc.wasm`, so it converts
      // it to `wasmer ./abc.wasm`.
      if (commandName.indexOf("/") == -1) {
        commandName = `./${commandName}`;
      }
    }
    else if (commandName == "wapm" && options.args[1] == "run") {
      options.args = options.args.slice(2);
      commandName = options.args[0];
    }
    else if (commandName == "wax") {
      options.args = options.args.slice(1);
      commandName = options.args[0];
    }

    // We are executing a WebAssembly file
    if (commandName.indexOf("/") > -1) {
      let modulePath = commandName;
      if (!this.wasmFs.fs.existsSync(modulePath)) {
        throw new Error(`No such file or directory: ${modulePath}`);
      }
      let wasmBinary = this.wasmFs.fs.readFileSync(modulePath);
      let loweredBinary = await lowerI64Imports(wasmBinary);
      COMPILED_MODULES[modulePath] = await WebAssembly.compile(loweredBinary);
      return {
        args: options.args,
        module: COMPILED_MODULES[modulePath]
      };
    }


    // Check if the command was cached
    const cachedCommand = this._getCachedCommand(commandName);
    if (cachedCommand) {
      return cachedCommand;
    }

    // Try to install from WAPM
    return await this._installFromWapmCommand(options, this.wasmFs);
  }

  async installWasmBinary(commandName, wasmBinary) {
    this.uploadedCommands[commandName] = wasmBinary;
    await this._syncToStorage();
  }

  async _updateFromStorage() {
    const wapmStorage = await idbKeyval.get(STORAGE_KEY);

    if (!wapmStorage) {
      return;
    }

    if (wapmStorage.wapmInstalledPackages) {
      this.wapmInstalledPackages = wapmStorage.wapmInstalledPackages;
    }

    if (wapmStorage.wapmCommands) {
      this.wapmCommands = wapmStorage.wapmCommands;
    }

    if (wapmStorage.uploadedCommands) {
      this.uploadedCommands = wapmStorage.uploadedCommands;
    }

    if (wapmStorage.cachedModules) {
      this.cachedModules = wapmStorage.cachedModules;
    }
  }

  async _syncToStorage() {
    // Do nothing for now.

    // const wapmStorage = {
    //   wapmInstalledPackages: this.wapmInstalledPackages,
    //   uploadedCommands: this.uploadedCommands,
    //   cachedModules: this.cachedModules
    // };
    // await idbKeyval.set(STORAGE_KEY, wapmStorage);
  }

  _getCachedCommand(commandName) {
    if (this.callbackCommands[commandName]) {
      return this.callbackCommands[commandName];
    }
    if (this.uploadedCommands[commandName]) {
      return this.uploadedCommands[commandName];
    }

    return undefined;
  }

  async _wapmCallbackCommand(options, wasmFs) {
    const args = options.args;
    if (args.length === 1) {
      return this._help();
    }

    if (args[1] === "upload") {
      const commandName = await this._installFromFile();
      const uploadMessage = `Module ${commandName}.wasm installed successfully!
→ Installed commands: ${commandName}`;
      return uploadMessage.replace(/\n\n/g, "\n \n");
    }

    if (args[1] === "install" && args.length === 3) {
      return await this._install(args[2], wasmFs);
    }

    if (args[1] === "uninstall" && args.length === 3) {
      return await this._uninstall(args[2]);
    }

    if (args[1] === "list") {
      return this._list();
    }

    return this._help();
  }

  _help() {
    const helpMessage = `wapm-cli lite (adapted for WebAssembly.sh)
The Wasmer Engineering Team <engineering@wasmer.io>
WebAssembly Package Manager CLI

USAGE:
    wapm <SUBCOMMAND>

SUBCOMMANDS:
    list                           List the currently installed packages and their commands
    install                        Install a package from Wapm
    upload                         Install a local Wasm module
    uninstall                      Uninstall a package`;

    return helpMessage.replace(/\n\n/g, "\n \n");
  }

  _list() {
    let packageModules = [];
    Object.keys(this.wapmInstalledPackages).forEach(key => {
      let _package = this.wapmInstalledPackages[key];
      _package.modules.forEach(mod => {
        packageModules.push([
          _package.package.displayName,
          _package.version,
          mod.name,
          mod.abi
        ]);
      });
    });

    let packages = [["COMMAND", "VERSION", "MODULE", "ABI"]].concat(
      packageModules
    );

    let commands = [["COMMAND", "TYPE"]]
      .concat(
        Object.keys(this.wapmCommands).map(key => {
          return [`${key}`, "WAPM"];
        })
      )
      .concat(
        Object.keys(this.uploadedCommands).map(key => {
          return [`${key}`, "uploaded by user"];
        })
      )
      .concat(
        Object.keys(this.callbackCommands).map(key => {
          return [`${key}`, "builtin"];
        })
      );

    let message = `LOCAL PACKAGES:
 ${table(packages, { align: ["l"], hsep: " | " }).replace(/\n/g, "\n ")}
    
LOCAL COMMANDS:
 ${table(commands, { align: ["l"], hsep: " | " }).replace(/\n/g, "\n ")}

Additional commands can be installed by: 
    • Running a command from any WASI package in https://wapm.io
    • Uploading a file with \`wapm upload\``;

    return message.replace(/\n\n/g, "\n \n");
  }

  async _install(packageName, wasmFs) {
    let packageVersion = await getWAPMPackageFromPackageName(packageName);
    if (!packageVersion) {
      throw new Error(`Package not found in the registry: ${packageName}`);
    }
    // console.log(`Running wapm install ${packageName}`);
    let installed = await this._installWapmPackage(packageVersion, wasmFs);
    if (!installed) {
      return `Package ${packageName} already installed.`
    }
    this.wapmInstalledPackages = this.wapmInstalledPackages.filter(
      installedPackage =>
        installedPackage.package.displayName !== packageVersion.package.displayName
    );
    this.wapmInstalledPackages.push(packageVersion);
    await this.regenerateWAPMCommands();
    await this._syncToStorage();
    return `Package ${packageVersion.package.displayName}@${
      packageVersion.version
    } installed successfully!
→ Installed commands: ${packageVersion.commands
      .map(command => command.command)
      .join(", ")}`;
  }

  async _uninstall(packageOrCommandName) {
    // Uninstalling a callback (should error)
    if (this.callbackCommands[packageOrCommandName]) {
      return `Cannot remove the built-in command: \`${packageOrCommandName}\`.`;
    }

    // Uninstalling an uploaded command
    if (this.uploadedCommands[packageOrCommandName]) {
      delete this.uploadedCommands[packageOrCommandName];
      await this._syncToStorage();
      return `Uploaded command "${packageOrCommandName}" uninstalled successfully.`;
    }

    // Uninstalling a wapm package
    let wapmInstalledPackage = this.wapmInstalledPackages.filter(
      installedPackage =>
        installedPackage.package.displayName === packageOrCommandName
    );
    if (wapmInstalledPackage) {
      wapmInstalledPackage = wapmInstalledPackage[0];
      this.wapmInstalledPackages = this.wapmInstalledPackages.filter(
        installedPackage => installedPackage !== wapmInstalledPackage
      );
      await this.regenerateWAPMCommands();

      await this._syncToStorage();
      return `Package "${wapmInstalledPackage.package.displayName}" uninstalled successfully.`;
    }

    return `Package "${packageOrCommandName}" is not installed.`;
  }

  async _installWapmPackage(packageVersion, wasmFs) {
    // console.log("Install package", packageVersion)
    const packageUrl = packageVersion.distribution.downloadUrl;
    let binary = await getBinaryFromUrl(packageUrl);
  
    const installedPath = `/_wasmer/wapm_packages/${packageVersion.package.name}@${packageVersion.version}`;
    if (wasmFs.fs.existsSync(installedPath)) {
      // console.log("package already installed");
      // The package is already installed.
      // Do nothing.
      return false;
    }

    wasmFs.fs.mkdirpSync(installedPath);
    // We extract the contents on the desired directory
    await extractContents(wasmFs, binary, installedPath);
    // console.log("CONTENTS extracted");

    wasmFs.fs.mkdirpSync("/bin");
    for (let command of packageVersion.commands) {
      const binaryName = `/bin/${command.command}`;
      const wasmFullPath = `${installedPath}/${command.module.source}`;
      const filesystem = packageVersion.filesystem;
      let preopens = {};
      filesystem.forEach(({ wasm, host }) => {
        preopens[wasm] = `${installedPath}/${host}`;
      });
      const mainFunction = new Function(`// wasi
  return function main(options) {
  var preopens = ${JSON.stringify(preopens)};
  return {
  "args": options.args,
  "env": options.env,
  // We use the path for the lowered Wasm
  "modulePath": ${JSON.stringify(wasmFullPath)},
  "preopens": preopens,
  };
  }
  `)();
      wasmFs.fs.writeFileSync(binaryName, mainFunction.toString());
    };
    return true;
  }
  async _installFromWapmCommand({ args, env }, wasmFs) {
      let commandName = args[0];
    // const wasmPackage = await getWAPMPackageFromCommandName(commandName);
    // await this.regenerateWAPMCommands();
    // await this._syncToStorage();
    // return this.wapmCommands[commandName];
    const binaryName = `/bin/${commandName}`;
    if (!wasmFs.fs.existsSync(binaryName)) {
      let command = await fetchCommandFromWAPM({args, env});
      await this._installWapmPackage(command.packageVersion, wasmFs);
    }
    // let time1 = performance.now();
    let fileContents = wasmFs.fs.readFileSync(binaryName, "utf8");
    let mainProgram = new Function(`return ${fileContents}`)();
    let program = mainProgram({args, env});
    // let time2 = performance.now();
    if (!(program.modulePath in COMPILED_MODULES)) {
      let wasmBinary;
      try {
        wasmBinary = wasmFs.fs.readFileSync(program.modulePath);
      } catch {
        throw new Error(
          `The module ${program.modulePath} doesn't exist`
        );
      }
      // time2 = performance.now();
      this.wasmTerminal.wasmTty.clearStatus(true);
      this.wasmTerminal.wasmTty.printStatus("[INFO] Compiling module", true);

      let loweredBinary = await lowerI64Imports(wasmBinary);

      COMPILED_MODULES[program.modulePath] = await WebAssembly.compile(loweredBinary);
      this.wasmTerminal.wasmTty.clearStatus(true);
    }
    program.module = COMPILED_MODULES[program.modulePath];
    // let time3 = performance.now();
    // console.log(`Miliseconds to run: ${time2-time1} (lowering) ${time3-time2} (compiling)`);
    return program;
  }

  async _installFromFile() {
    const gotInputPromise = new Promise(resolve => {
      this.currentInstallResolver = resolve;
    });
    this._hiddenInput.click();

    const file = await gotInputPromise;

    if (!file) {
      return "Cancelled opening wasm file.";
    }

    const buffer = await file.arrayBuffer();
    const wasmBinary = new Uint8Array(buffer);

    const commandName = file.name.replace(".wasm", "");

    this.installWasmBinary(commandName, wasmBinary);
    return commandName;
  }

  _onHiddenInputChange(event) {
    if (this.currentInstallResolver) {
      this.currentInstallResolver(event.target.files[0]);
    }
  }
}
