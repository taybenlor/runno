import { Runtime } from "@runno/host";

// const fortran77 = `
//     PROGRAM HELLO
// *   The PRINT statement is like WRITE,
// *   but prints to the standard output unit
//         PRINT '(A)', 'Hello, world'
//         STOP
//     END
// `;

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
`.trimStart();

const cpp = `
#include <iostream>
int main() {
  std::cout << "Hello, World!" << std::endl << "What's your name? ";
  std::string name;
  getline(std::cin, name);
  std::cout << "G'day " << name << ", welcome to Runno." << std::endl;
  return 0;
}
`.trimStart();

const python = `
print("Hello, World!")
name = input("What's your name? ")
print(f"G'day {name}, welcome to Runno.")
`.trimStart();

const ruby = `
puts "Hello, World!"
print "What's your name? " 
name = gets.chomp
puts "G'day #{name}, welcome to Runno."
`.trimStart();

const quickjs = `
std.out.puts("Hello, World!\\nWhat's your name? ");
std.out.flush();
const name = std.in.getline();
console.log(\`G'day \${name}, welcome to Runno.\`);
`.trimStart();

const sqlite = `
SELECT "Hello, World!";
SELECT "G'day, welcome to Runno.";
`.trimStart();

export function exampleForRuntime(name: Runtime): string {
  if (name == "sqlite") {
    return sqlite;
  }

  if (name == "quickjs") {
    return quickjs;
  }

  if (name == "clang") {
    return c;
  }

  if (name == "clangpp") {
    return cpp;
  }

  if (name == "python") {
    return python;
  }

  if (name == "ruby") {
    return ruby;
  }

  return "";
}
