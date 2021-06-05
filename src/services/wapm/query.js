// Fetch Command Function to fetch a command from WAPM
const WAPM_GRAPHQL_QUERY = `query shellGetCommandQuery($command: String!) {
  command: getCommand(name: $command) {
    command
    module {
      name
      abi
      source
    }
    packageVersion {
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
}`;

const getCommandFromWAPM = async (commandName) => {
  const fetchResponse = await fetch("https://registry.wapm.io/graphql", {
    method: "POST",
    mode: "cors",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      operationName: "shellGetCommandQuery",
      query: WAPM_GRAPHQL_QUERY,
      variables: {
        command: commandName
      }
    })
  });
  const response = await fetchResponse.json();

  if (response && response.data && response.data.command) {
    return response.data.command;
  } else {
    throw new Error(`command not found ${commandName}`);
  }
};

export const fetchCommandFromWAPM = async ({args, env}) => {
  const commandName = args[0];
  const command = await getCommandFromWAPM(commandName);
  if (command.module.abi !== "wasi") {
    throw new Error(
      `Only WASI modules are supported. The "${commandName}" command is using the "${command.module.abi}" ABI.`
    );
  }
  return command;
};
