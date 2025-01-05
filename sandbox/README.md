# runno

Package for running code inside the Runno WebAssembly sandbox.

## Quickstart

The `run_code` method allows you to run a snippet of code.

```python
from runno import run_code

code = "print('Hello, World!')"
result = await run_code("python", code)

if result.result_type == "complete":
    print("OUTPUT:")
    print(result.tty)
else:
    print("ERROR")
```

Available runtimes are: `python`, `quickjs`, `sqlite`, `clang`, `clangpp`, `ruby`, and `php-cgi`.

## Including Files

If you want to process files within your sandbox, you can include them in the
file system by using the `run_fs` method.

```python
from runno import run_fs, WASIFS, StringFile, WASITimestamps

fs: WASIFS = {
    "/program.py": StringFile(
        path="/program.py",
        timestamps=WASITimestamps(
            access=datetime.now(),
            modification=datetime.now(),
            change=datetime.now(),
        ),
        mode="string",
        content="""
print(open('data.csv'))
""",
    ),
    "/data.csv": StringFile(
        path="/data.csv",
        timestamps=WASITimestamps(
            access=datetime.now(),
            modification=datetime.now(),
            change=datetime.now(),
        ),
        mode="string",
        content="""
a,b,c
1,2,3
""",
    )
}

await run_fs(runtime, "/program", fs)
```

## Including Dependencies

You can use the same technique to include pure python packages as dependencies.
The interface for this is not super nice right now, but it's on the way.

## Limiting Execution Time

You can limit how much time is allocated for execution using an optional
`timeout` kwarg (measured in seconds). Like:

```python
from runno import run_code

code = "while True: pass"
result = await run_code("python", code, timeout=5)

if result.result_type == "timeout":
    print("Timed out.")
else:
    print("Wow, it ran forever.")
```
