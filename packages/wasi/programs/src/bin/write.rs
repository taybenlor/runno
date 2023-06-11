use std::io::Read;
use std::{env, fs, io};

fn main() {
    let filename = env::args().nth(1).expect("no filename provided");

    let stdin = io::stdin();
    let mut buf = String::new();
    stdin
        .lock()
        .read_to_string(&mut buf)
        .expect("unable to read from STDIN");

    fs::write(&filename, &buf).expect("unable to create file");
}
