const fortran77 = `
    PROGRAM HELLO
*   The PRINT statement is like WRITE,
*   but prints to the standard output unit
        PRINT '(A)', 'Hello, world'
        STOP
    END
`;

const c = `
#include <stdio.h>
int main() {
  printf("Hello, World!\nWhat's your name? ");
  fflush(stdout);
  char *name;
  size_t length = 32;
  getline(&name, &length, stdin);
  name[strlen(name)-1] = '\0';
  printf("G'day %s, welcome to Runno.", name);
}
`;

const cpp = `
#include <iostream>
int main()
{
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
print(f"G'day {name}, welcome to Runno.");
`;
