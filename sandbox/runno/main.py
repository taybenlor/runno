import asyncio
from datetime import datetime
import json
import tarfile
import io
import os
from .types import (
    BaseFile,
    CompleteResult,
    CrashResult,
    Options,
    RunnoError,
    Runtime,
    WASIFS,
    TerminatedResult,
    TimeoutResult,
    WASIPath,
    StringFile,
    RunResult,
    WASITimestamps,
)


async def run_code(runtime: Runtime, code: str, **kwargs: Options) -> RunResult:
    """
    Run code in a Runno sandbox.

    Available runtimes: python, quickjs, sqlite, clang, clangpp, ruby, php-cgi
    """
    fs: WASIFS = {
        "/program": StringFile(
            path="/program",
            timestamps=WASITimestamps(
                access=datetime.now(),
                modification=datetime.now(),
                change=datetime.now(),
            ),
            mode="string",
            content=code,
        )
    }
    return await run_fs(runtime, "/program", fs, **kwargs)


async def run_fs(
    runtime: Runtime, entry_path: WASIPath, fs: WASIFS, **kwargs: Options
) -> RunResult:
    """
    Run code in a Runno sandbox with a custom filesystem.

    The `entry_path` is the path to the file that will be executed within that
    custom filesystem.

    This is useful for packaging multiple files together, or for running code that
    has dependencies on packages. The filesystem is a dictionary of paths to files.

    See the types module for more information on the WASIFS type.
    """
    try:
        return await asyncio.wait_for(
            _internal_run_fs(runtime, entry_path, fs, **kwargs),
            timeout=kwargs.get("timeout", None),
        )
    except asyncio.TimeoutError:
        return TimeoutResult(result_type="timeout")


async def _internal_run_fs(
    runtime: Runtime, entry_path: WASIPath, fs: WASIFS, **kwargs: Options
) -> RunResult:
    proc = await asyncio.create_subprocess_exec(
        "./runno",
        runtime,
        entry_path,
        "--filesystem-stdin",
        "--json",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=os.path.dirname(os.path.abspath(__file__)),
    )

    tar_fs: tarfile.TarFile = tarfile.open(mode="w:gz", fileobj=proc.stdin)
    for path, file in fs.items():
        if file.mode == "string":
            bytes = file.content.encode("utf-8")
        elif file.mode == "binary":
            bytes = file.content

        tar_info = tarfile.TarInfo(name=path)
        tar_info.size = len(bytes)
        tar_info.mtime = file.timestamps.modification.timestamp()

        tar_fs.addfile(tar_info, fileobj=io.BytesIO(bytes))

    tar_fs.close()

    stdout, stderr = await proc.communicate()
    exit_code = await proc.wait()

    if exit_code != 0:
        raise RuntimeError(
            f"Runno sandbox subprocess failed with exit code {exit_code}",
            stdout,
            stderr,
        )

    data = json.loads(stdout)
    result_type = data["resultType"]
    if result_type == "crash":
        return CrashResult(
            result_type="crash",
            error=RunnoError(
                type=data["error"]["type"],
                message=data["error"]["message"],
            ),
        )
    elif result_type == "terminated":
        return TerminatedResult(result_type="terminated")
    elif result_type == "complete":
        return CompleteResult(
            result_type="complete",
            stdin=data["stdin"],
            stdout=data["stdout"],
            stderr=data["stderr"],
            tty=data["tty"],
            fs={path: BaseFile.from_dict(file) for path, file in data["fs"].items()},
            exit_code=data["exitCode"],
        )
    else:
        raise ValueError(f"Unknown result type: {result_type}")


__all__ = ["run_code", "run_fs"]
