use std::io;
use std::io::Read;

fn main() {
    let stdin = io::stdin();
    let mut buf = String::new();
    stdin
        .lock()
        .read_to_string(&mut buf)
        .expect("unable to read");
    print!("{}", buf);
}
