from hatchling.builders.hooks.plugin.interface import BuildHookInterface
import os
import re


class CustomHook(BuildHookInterface):
    def initialize(self, version, build_data):
        build_data["tag"] = get_best_matching_tag()
        build_data["infer_tag"] = False
        build_data["pure_pyton"] = False


def get_best_matching_tag() -> str:
    """
    Copy of hatch.build.get_best_matching_tag() with the following changes:
    - Simplify the macos version guessing and make sure we end up with
      the version set in MACOSX_DEPLOYMENT_TARGET
    """
    import sys

    from packaging.tags import sys_tags

    # Linux tag is after many/musl; packaging tools are required to skip
    # many/musl, see https://github.com/pypa/packaging/issues/160
    tag = next(
        iter(
            t
            for t in sys_tags()
            if "manylinux" not in t.platform and "musllinux" not in t.platform
        )
    )
    tag_parts = [tag.interpreter, tag.abi, tag.platform]

    # Load target from environment & lower mac os minor version to 0
    if sys.platform == "darwin":
        if sdk_match := re.search(r"macosx_(\d+_\d+)", tag.platform):
            macos_version = sdk_match.group(1)
            target = os.environ.get("MACOSX_DEPLOYMENT_TARGET", None)
            if not target:
                raise ValueError("MACOSX_DEPLOYMENT_TARGET is not set")

            [os_major, _] = target.split(".")
            os_version = f"{os_major}_0"
            tag_parts[2] = tag.platform.replace(macos_version, os_version)

    return "-".join(tag_parts)
