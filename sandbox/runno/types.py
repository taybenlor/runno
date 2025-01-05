import base64
from typing import Literal, Union, Dict, TypedDict
from pydantic import BaseModel
from datetime import datetime

type WASIPath = str


class WASITimestamps(BaseModel):
    access: datetime
    modification: datetime
    change: datetime


class BaseFile(BaseModel):
    path: WASIPath
    timestamps: WASITimestamps
    mode: Union[Literal["string"], Literal["binary"]]

    @classmethod
    def from_dict(cls, data: Dict) -> "WASIFile":
        data["timestamps"] = WASITimestamps(
            **{
                key: datetime.fromisoformat(value)
                for key, value in data["timestamps"].items()
            }
        )

        if data["mode"] == "string":
            return StringFile(**data)
        elif data["mode"] == "binary":
            return BinaryFile(**data)
        elif data["mode"] == "base64":
            data["mode"] = "binary"
            data["content"] = base64.b64decode(data["content"])
            return BinaryFile(**data)
        else:
            raise ValueError(f"Invalid mode: {data['mode']}")


class BinaryFile(BaseFile):
    mode: Literal["binary"]
    content: bytes


class StringFile(BaseFile):
    mode: Literal["string"]
    content: str


type WASIFile = Union[BinaryFile, StringFile]
type WASIFS = Dict[WASIPath, WASIFile]

type Runtime = Union[
    Literal["python"],
    Literal["quickjs"],
    Literal["sqlite"],
    Literal["clang"],
    Literal["clangpp"],
    Literal["ruby"],
    Literal["php-cgi"],
]


class RunnoError(BaseModel):
    type: str
    message: str


class CrashResult(BaseModel):
    result_type: Literal["crash"]
    error: RunnoError


class CompleteResult(BaseModel):
    result_type: Literal["complete"]
    stdin: str
    stdout: str
    stderr: str
    tty: str
    fs: WASIFS
    exit_code: int


class TerminatedResult(BaseModel):
    result_type: Literal["terminated"]


class TimeoutResult(BaseModel):
    result_type: Literal["timeout"]


type RunResult = Union[CompleteResult, CrashResult, TerminatedResult, TimeoutResult]


class Options(TypedDict):
    timeout: float


__all__ = [
    "StringFile",
    "BinaryFile",
    "WASIFS",
    "WASITimestamps",
    "Options",
    "RunnoError",
    "Runtime",
    "WASIPath",
    "RunResult",
    "TimeoutResult",
    "TerminatedResult",
    "CompleteResult",
    "CrashResult",
]
