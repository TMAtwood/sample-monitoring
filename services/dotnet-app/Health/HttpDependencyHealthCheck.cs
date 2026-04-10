using System.Diagnostics;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DotnetApp.Health;

/// <summary>
/// Readiness check: probes an HTTP endpoint to verify an external dependency is reachable.
/// Reports the response status code and elapsed time.
/// </summary>
public class HttpDependencyHealthCheck : IHealthCheck
{
    private readonly HttpClient _httpClient;
    private readonly string _uri;
    private readonly string _dependencyName;

    public HttpDependencyHealthCheck(HttpClient httpClient, string uri, string dependencyName)
    {
        _httpClient = httpClient;
        _uri = uri;
        _dependencyName = dependencyName;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            using var response = await _httpClient.GetAsync(_uri, cancellationToken);
            sw.Stop();

            var data = new Dictionary<string, object>
            {
                { "endpoint", _uri },
                { "status_code", (int)response.StatusCode },
                { "response_time_ms", sw.ElapsedMilliseconds }
            };

            if (response.IsSuccessStatusCode)
            {
                return new HealthCheckResult(
                    HealthStatus.Healthy,
                    $"{_dependencyName} is reachable ({sw.ElapsedMilliseconds} ms)",
                    data: data);
            }

            return new HealthCheckResult(
                HealthStatus.Unhealthy,
                $"{_dependencyName} returned {(int)response.StatusCode} ({sw.ElapsedMilliseconds} ms)",
                data: data);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new HealthCheckResult(
                HealthStatus.Unhealthy,
                $"{_dependencyName} is unreachable: {ex.Message}",
                exception: ex,
                data: new Dictionary<string, object>
                {
                    { "endpoint", _uri },
                    { "response_time_ms", sw.ElapsedMilliseconds }
                });
        }
    }
}
