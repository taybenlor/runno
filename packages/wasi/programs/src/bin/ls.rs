use std::{env, fs};

fn main() {
    let dir = env::args().nth(1).unwrap_or_else(|| ".".to_string());

    for file in fs::read_dir(&dir).expect("unable to read dir") {
        if let Ok(f) = file {
            println!("{}", f.file_name().to_string_lossy());
        } else {
            println!("ERROR: unable to list file");
        }
    }
}
