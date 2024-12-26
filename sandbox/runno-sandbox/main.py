import asyncio
from datetime import datetime
from .types import Runtime, WASIFS, WASIPath, WASIStringFile, RunResult, WASITimestamps


async def run_code(runtime: Runtime, code: str) -> RunResult:
    fs: WASIFS = {
        "/program": WASIStringFile(
            path="/program",
            timestamps=WASITimestamps(
                access=datetime.now(),
                modified=datetime.now(),
                change=datetime.now(),
            ),
            mode="string",
            content=code,
        )
    }
    return await run_fs(runtime, "/program", fs)


async def run_fs(runtime: Runtime, entry_path: WASIPath, fs: WASIFS) -> RunResult:
    proc = await asyncio.create_subprocess_exec(
        f"./runno",
        runtime,
        entry_path,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    proc.stdin.write(b"Hello, World!")

    stdout, stderr = await proc.communicate()
    pass
