from unittest.mock import patch

import azure.functions as func

from function_app import process


def test_process_success():
    req = func.HttpRequest(method="POST", url="/api/process", body=b"")
    with (
        patch("function_app.random.random", return_value=0.5),
        patch("function_app.random.uniform", return_value=0.05),
        patch("function_app.push_metrics"),
    ):
        response = process(req)
        assert response.status_code == 200
        assert "Processed successfully" in response.get_body().decode()


def test_process_error():
    req = func.HttpRequest(method="POST", url="/api/process", body=b"")
    with (
        patch("function_app.random.random", return_value=0.01),
        patch("function_app.random.uniform", return_value=0.05),
        patch("function_app.push_metrics"),
    ):
        response = process(req)
        assert response.status_code == 500
        assert "error" in response.get_body().decode()
