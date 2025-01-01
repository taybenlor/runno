from runno import run_code
import asyncio


async def main():
    runtime = "python"
    code = "print('Hello, World!')"
    result = await run_code(runtime, code)
    if result.result_type == "complete":
        print("COMPLETE")
        print(result.tty)
    elif result.result_type == "crash":
        print("CRASH")
        print(result.error.message)
    elif result.result_type == "terminated":
        print("TERMINATED")
    else:
        print("UNKNOWN")


if __name__ == "__main__":
    asyncio.run(main())
