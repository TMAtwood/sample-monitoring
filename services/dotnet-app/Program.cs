using DotnetApp.Health;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHttpClient("health-probes", client =>
{
    client.Timeout = TimeSpan.FromSeconds(5);
});
builder.Services.AddHttpClient("services", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

// ── PostgreSQL ──────────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("OrdersDb")
    ?? throw new InvalidOperationException("Missing ConnectionStrings__OrdersDb");
var dataSource = new NpgsqlDataSourceBuilder(connectionString).Build();
builder.Services.AddSingleton(dataSource);

builder.Services.AddHealthChecks()
    // ── Liveness checks (app self-diagnostics) ──
    .AddCheck<MemoryHealthCheck>("memory",
        failureStatus: HealthStatus.Degraded,
        tags: ["live"])
    .AddCheck<UptimeHealthCheck>("uptime",
        tags: ["live"])
    // ── Readiness checks (external dependencies) ──
    .AddCheck<DatabaseHealthCheck>("postgresql",
        failureStatus: HealthStatus.Unhealthy,
        tags: ["ready"])
    .AddCheck<DiskSpaceHealthCheck>("disk_space",
        failureStatus: HealthStatus.Degraded,
        tags: ["ready"])
    .Add(new HealthCheckRegistration(
        name: "thanos_query",
        factory: sp =>
        {
            var httpClient = sp.GetRequiredService<IHttpClientFactory>().CreateClient("health-probes");
            return new HttpDependencyHealthCheck(httpClient, "http://thanos-query:9090/-/healthy", "Thanos Query");
        },
        failureStatus: HealthStatus.Unhealthy,
        tags: ["ready"],
        timeout: TimeSpan.FromSeconds(5)))
    .Add(new HealthCheckRegistration(
        name: "loki",
        factory: sp =>
        {
            var httpClient = sp.GetRequiredService<IHttpClientFactory>().CreateClient("health-probes");
            return new HttpDependencyHealthCheck(httpClient, "http://loki:3100/ready", "Loki");
        },
        failureStatus: HealthStatus.Unhealthy,
        tags: ["ready"],
        timeout: TimeSpan.FromSeconds(5)))
    .Add(new HealthCheckRegistration(
        name: "prometheus",
        factory: sp =>
        {
            var httpClient = sp.GetRequiredService<IHttpClientFactory>().CreateClient("health-probes");
            return new HttpDependencyHealthCheck(httpClient, "http://prometheus-use1-1:9090/-/healthy", "Prometheus");
        },
        failureStatus: HealthStatus.Unhealthy,
        tags: ["ready"],
        timeout: TimeSpan.FromSeconds(5)));

builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService(
        serviceName: Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "dotnet-app"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddSource("Npgsql")
        .AddOtlpExporter());

var app = builder.Build();

app.UseRouting();
app.UseHttpMetrics();
app.MapControllers();

// /health — all checks
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = HealthCheckResponseWriter.WriteResponse,
    ResultStatusCodes =
    {
        [HealthStatus.Healthy] = StatusCodes.Status200OK,
        [HealthStatus.Degraded] = StatusCodes.Status200OK,
        [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable
    }
});

// /health/live — liveness only (is the process alive and functional?)
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live"),
    ResponseWriter = HealthCheckResponseWriter.WriteResponse,
    ResultStatusCodes =
    {
        [HealthStatus.Healthy] = StatusCodes.Status200OK,
        [HealthStatus.Degraded] = StatusCodes.Status200OK,
        [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable
    }
});

// /health/ready — readiness only (are all external dependencies reachable?)
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = HealthCheckResponseWriter.WriteResponse,
    ResultStatusCodes =
    {
        [HealthStatus.Healthy] = StatusCodes.Status200OK,
        [HealthStatus.Degraded] = StatusCodes.Status200OK,
        [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable
    }
});

app.MapMetrics();

app.Run();

// Make Program accessible to test project
public partial class Program { }
