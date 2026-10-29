"""RFC 9457 problem details for every error response (ADR-001).

All 4xx and 5xx responses use application/problem+json with a stable `type`
URI, so clients can branch on the problem type rather than message text.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM_MEDIA_TYPE = "application/problem+json"

_STATUS_SLUGS: dict[int, str] = {
    400: "bad-request",
    401: "unauthorized",
    403: "forbidden",
    404: "not-found",
    405: "method-not-allowed",
    409: "conflict",
    412: "precondition-failed",
    413: "payload-too-large",
    415: "unsupported-media-type",
    422: "validation-failed",
    429: "rate-limited",
    500: "internal-error",
    503: "unavailable",
}


def problem_response(
    request: Request,
    status: int,
    detail: str,
    *,
    slug: str | None = None,
    errors: list[dict[str, str]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    base = str(request.app.state.settings.problem_type_base)
    body: dict[str, Any] = {
        "type": f"{base}{slug or _STATUS_SLUGS.get(status, 'error')}",
        "title": _STATUS_SLUGS.get(status, "error").replace("-", " ").capitalize(),
        "status": status,
        "detail": detail,
        "instance": request.url.path,
    }
    if errors is not None:
        body["errors"] = errors
    return JSONResponse(body, status_code=status, media_type=PROBLEM_MEDIA_TYPE, headers=headers)


def install_problem_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return problem_response(
            request,
            exc.status_code,
            str(exc.detail),
            headers=dict(exc.headers) if exc.headers else None,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(part) for part in err.get("loc", ())),
                "message": str(err.get("msg", "invalid")),
            }
            for err in exc.errors()
        ]
        return problem_response(request, 422, "The request did not pass validation.", errors=errors)
