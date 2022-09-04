use std::env;

fn main() {
    for env in env::args().skip(1) {
        print!("{} ", env);
    }
}
