// TODO: Write specs on args
//
// args_get(argv: Pointer<Pointer<u8>>, argv_buf: Pointer<u8>) -> Result<(), errno>
// Read command-line argument data. The size of the array should match that returned by args_sizes_get. Each argument is expected to be \0 terminated.
// Params
//     argv: Pointer<Pointer<u8>>
//     argv_buf: Pointer<u8>
// Results
//     error: Result<(), errno>
// Variant Layout
//     size: 8
//     align: 4
//     tag_size: 4
// Variant cases
//     ok
//     err: errno
