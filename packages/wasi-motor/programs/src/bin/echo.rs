use std::env;

fn main() {
    for arg in env::args().skip(1) {
        print!("{} ", arg);
    }
}
