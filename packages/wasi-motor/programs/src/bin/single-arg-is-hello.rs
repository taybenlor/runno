use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 1 {
        std::process::exit(exitcode::USAGE);
    }

    let first_arg = &args[0];
    if first_arg == "hello" {
        std::process::exit(exitcode::OK);
    } else {
        std::process::exit(exitcode::USAGE);
    }
}
