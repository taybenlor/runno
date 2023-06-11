use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        std::process::exit(exitcode::USAGE);
    }

    let first_arg = &args[0];
    if first_arg != "foo" {
        std::process::exit(exitcode::USAGE);
    }

    let second_arg = &args[1];
    if second_arg != "bar" {
        std::process::exit(exitcode::USAGE);
    }

    let third_arg = &args[2];
    if third_arg != "baz" {
        std::process::exit(exitcode::USAGE);
    }

    std::process::exit(exitcode::OK);
}
