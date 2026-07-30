fn main() {
    println!("Hello from WASI 0.2!");
    let args: Vec<String> = std::env::args().skip(1).collect();
    if !args.is_empty() {
        println!("args: {}", args.join(","));
    }
    if let Ok(value) = std::env::var("RUNNO_TEST") {
        println!("env: {value}");
    }
}
