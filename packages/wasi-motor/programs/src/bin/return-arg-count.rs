use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    std::process::exit(args.len() as i32);
}
