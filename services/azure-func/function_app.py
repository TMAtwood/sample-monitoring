import json
import logging
import os
import random
import time

import azure.functions as func
from prometheus_client import CollectorRegistry, Counter, Histogram, push_to_gateway

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

# OpenTelemetry setup
resource = Resource.create(
    {"service.name": os.environ.get("OTEL_SERVICE_NAME", "azure-func")}
)
provider = TracerProvider(resource=resource)
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

app = func.FunctionApp()

PUSHGATEWAY_URL = os.environ.get("PUSHGATEWAY_URL", "pushgateway:9091")
REGISTRY = CollectorRegistry()

invocation_count = Counter(
    "azure_func_invocations_total",
    "Total Azure Function invocations",
    ["function_name", "status"],
    registry=REGISTRY,
)

invocation_duration = Histogram(
    "azure_func_invocation_duration_seconds",
    "Azure Function invocation duration",
    ["function_name"],
    registry=REGISTRY,
)


def push_metrics():
    """Push metrics to Pushgateway."""
    try:
        push_to_gateway(PUSHGATEWAY_URL, job="azure-func", registry=REGISTRY)
    except Exception as e:
        logging.warning(f"Failed to push metrics to Pushgateway: {e}")


@app.route(route="process", auth_level=func.AuthLevel.ANONYMOUS)
def process(req: func.HttpRequest) -> func.HttpResponse:
    with tracer.start_as_current_span("process-request") as span:
        start = time.monotonic()
        status = "success"
        try:
            # Simulate work (50-500ms)
            work_time = random.uniform(0.05, 0.5)
            time.sleep(work_time)

            # Simulate ~5% error rate
            if random.random() < 0.05:
                raise Exception("Simulated processing error")

            span.set_attribute("processing.duration_ms", round(work_time * 1000))
            result = {
                "message": "Processed successfully",
                "duration_ms": round(work_time * 1000),
            }
            return func.HttpResponse(
                body=json.dumps(result),
                status_code=200,
                mimetype="application/json",
            )
        except Exception as e:
            status = "error"
            span.set_status(trace.StatusCode.ERROR, str(e))
            span.record_exception(e)
            return func.HttpResponse(
                body=json.dumps({"error": str(e)}),
                status_code=500,
                mimetype="application/json",
            )
        finally:
            duration = time.monotonic() - start
            invocation_count.labels(function_name="process", status=status).inc()
            invocation_duration.labels(function_name="process").observe(duration)
            push_metrics()


@app.timer_trigger(schedule="0 */1 * * * *", arg_name="timer")
def metrics_push(timer: func.TimerRequest) -> None:
    """Push accumulated metrics to Pushgateway every minute."""
    push_metrics()
    logging.info("Pushed metrics to Pushgateway")
