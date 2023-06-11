fn main() {
    let args: Vec<String> = std::env::args().collect();
    std::process::exit(args.len() as i32);
}
