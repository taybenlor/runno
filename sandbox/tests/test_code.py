import pytest
from runno import run_code


@pytest.mark.asyncio
async def test_simple_python():
    result = await run_code("python", "print('Hello, world!')")
    assert result.result_type == "complete"
    assert result.stdout == "Hello, world!\n"
    assert result.stderr == ""
    assert result.exit_code == 0


@pytest.mark.asyncio
async def test_simple_ruby():
    result = await run_code("ruby", 'puts "Hello, World!"')
    assert result.result_type == "complete"
    assert result.stdout == "Hello, World!\n"
    assert result.stderr == ""
    assert result.exit_code == 0


@pytest.mark.asyncio
async def test_simple_js():
    result = await run_code("quickjs", 'console.log("Hello, World!");')
    assert result.result_type == "complete"
    assert result.stdout == "Hello, World!\n"
    assert result.stderr == ""
    assert result.exit_code == 0


@pytest.mark.asyncio
async def test_simple_php():
    result = await run_code("php-cgi", '<?php\nprint "Hello, World!\\n";\n?>')
    assert result.result_type == "complete"
    # TODO: php-cgi outputs X-Powered-By headers which we don't want here
    assert "Hello, World!\n" in result.stdout
    assert result.stderr == ""
    assert result.exit_code == 0


@pytest.mark.asyncio
async def test_simple_c():
    result = await run_code(
        "clang",
        '#include <stdio.h>\nint main() {\n  printf("Hello, World!\\n");\n  return 0;\n}',
    )
    assert result.result_type == "complete"
    assert result.stdout == "Hello, World!\n"
    assert result.stderr == ""
    assert result.exit_code == 0


@pytest.mark.asyncio
async def test_simple_cpp():
    result = await run_code(
        "clangpp",
        '#include <iostream>\nint main() {\n  std::cout << "Hello, World!" << std::endl;\n  return 0;\n}',
    )
    assert result.result_type == "complete"
    assert result.stdout == "Hello, World!\n"
    assert result.stderr == ""
    assert result.exit_code == 0


@pytest.mark.asyncio
async def test_timeout():
    result = await run_code("python", "while True: pass", timeout=0.1)
    assert result.result_type == "timeout"
