use std::io;
use std::io::Write;

fn main() {
    println!("Hello, World!");
    print!("What's your name? ");
    io::stdout().flush().unwrap();
    let stdin = io::stdin();
    let mut name = String::new();
    stdin.read_line(&mut name).expect("Unable to read line");
    println!("G'day {}, welcome to Runno.", name.trim_end());
}
