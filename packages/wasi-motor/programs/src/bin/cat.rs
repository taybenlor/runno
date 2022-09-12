use std::{env, fs};

fn main() {
    for filename in env::args().skip(1) {
        let content = fs::read_to_string(filename).expect("unable to read file");
        print!("{}", content);
    }
}
