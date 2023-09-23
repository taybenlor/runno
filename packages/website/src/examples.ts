import { Runtime } from "@runno/runtime";
import { assertUnreachable } from "./helpers";

const c = `
  #include <stdio.h>
  #include <string.h>
  int main() {
    printf("Hello, World!\\nWhat's your name? ");
    fflush(stdout);
    char *name;
    size_t length = 32;
    getline(&name, &length, stdin);
    name[strlen(name)-1] = '\\0';
    printf("G'day %s, welcome to Runno.", name);
  }
`;

const cpp = `
  #include <iostream>
  int main() {
    std::cout << "Hello, World!" << std::endl << "What's your name? ";
    std::string name;
    getline(std::cin, name);
    std::cout << "G'day " << name << ", welcome to Runno." << std::endl;
    return 0;
  }
`;

const python = `
  print("Hello, World!")
  name = input("What's your name? ")
  print(f"G'day {name}, welcome to Runno.")
`;

const ruby = `
  puts "Hello, World!"
  print "What's your name? " 
  name = gets.chomp
  puts "G'day #{name}, welcome to Runno."
`;

const quickjs = `
  import * as std from "std";
  std.out.puts("Hello, World!\\nWhat's your name? ");
  std.out.flush();
  const name = std.in.getline();
  console.log(\`G'day \${name}, welcome to Runno.\`);
`;

const sqlite = `
  SELECT "Hello, World!";
  SELECT "G'day, welcome to Runno.";
`;

const php = `
  <?php
  print "Hello, World!\\n";
  print "G'day, welcome to Runno.\\n";
  ?>
`;

export function exampleForRuntime(name: Runtime): string {
  switch (name) {
    case "ruby":
      return ruby;
    case "python":
      return python;
    case "clangpp":
      return cpp;
    case "clang":
      return c;
    case "quickjs":
      return quickjs;
    case "sqlite":
      return sqlite;
    case "php-cgi":
      return php;
    default:
      return assertUnreachable(name, `Unknown runtime ${name}.`);
  }
}
