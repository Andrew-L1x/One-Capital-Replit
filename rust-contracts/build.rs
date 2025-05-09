fn main() {
    // Tell Cargo that if the input files change, to rerun this build script.
    println!("cargo:rerun-if-changed=src/");
}