from typing import Literal, Union, Dict
from pydantic import BaseModel
from datetime import datetime

type WASIPath = str


class WASITimestamps(BaseModel):
    access: datetime
    modified: datetime
    change: datetime


class BaseFile(BaseModel):
    path: WASIPath
    timestamps: WASITimestamps
    mode: Union[Literal["string"], Literal["binary"]]


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


class CrashResult(BaseModel):
    result_type: Literal["crash"]
    error: Dict[str, str]


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


type RunResult = Union[CompleteResult, CrashResult, TerminatedResult]
