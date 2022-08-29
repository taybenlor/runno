fn main() {
    let file_contents = std::fs::read_to_string("foo.txt").expect("unable to read file");
    print!("{}", file_contents);
}
