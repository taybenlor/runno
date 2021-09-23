const fortran77 = `
    PROGRAM HELLO
*   The PRINT statement is like WRITE,
*   but prints to the standard output unit
        PRINT '(A)', 'Hello, world'
        STOP
    END
`;

const c = `
#include <stdio.h>;
int main() {
  printf("Hello, world!");
}
`;

const python = `
print("Hello, world!")
name = input("What's your name? ")
print(f"G'day {name}, welcome to Runno.");
`;
