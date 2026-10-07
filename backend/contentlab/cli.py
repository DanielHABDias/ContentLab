import argparse
import json
import sys

from .errors import ContentLabError, PlanValidationError
from .registry import describe_registry
from .render import render_edit_plan
from .service import validate_edit_plan


def build_parser():
    parser = argparse.ArgumentParser(prog="contentlab", description="Motor de edição do Content Lab")
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate", help="Valida um edit_plan.json")
    validate.add_argument("plan")
    validate.add_argument("--project-root")
    render = commands.add_parser("render", help="Renderiza um edit_plan.json")
    render.add_argument("plan")
    render.add_argument("--project-root")
    render.add_argument("--output-dir")
    render.add_argument("--mode", choices=("rough", "final"), default="rough")
    commands.add_parser("plugins", help="Lista as capacidades registradas")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        if args.command == "plugins":
            result = describe_registry()
        elif args.command == "render":
            result = render_edit_plan(args.plan, args.output_dir, args.project_root, mode=args.mode)
        else:
            result = validate_edit_plan(args.plan, args.project_root)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("valid", True) else 2
    except PlanValidationError as exc:
        print(json.dumps({"valid": False, "errors": exc.issues}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2
    except ContentLabError as exc:
        print(json.dumps({"valid": False, "errors": [{"message": str(exc)}]}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
