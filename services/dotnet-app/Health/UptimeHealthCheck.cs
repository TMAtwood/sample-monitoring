using System.Diagnostics;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DotnetApp.Health;

/// <summary>
/// Liveness check: reports how long the process has been running.
/// Always returns Healthy — its purpose is to surface uptime data.
/// </summary>
public class UptimeHealthCheck : IHealthCheck
{
    private static readonly DateTime StartTime = DateTime.UtcNow;

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var uptime = DateTime.UtcNow - StartTime;
        var process = Process.GetCurrentProcess();

        var data = new Dictionary<string, object>
        {
            { "start_time", StartTime.ToString("O") },
            { "uptime", uptime.ToString(@"d\.hh\:mm\:ss") },
            { "uptime_seconds", Math.Round(uptime.TotalSeconds, 1) },
            { "process_id", Environment.ProcessId },
            { "thread_count", process.Threads.Count },
            { "dotnet_version", Environment.Version.ToString() }
        };

        return Task.FromResult(new HealthCheckResult(
            HealthStatus.Healthy,
            $"Up for {uptime:d\\.hh\\:mm\\:ss}",
            data: data));
    }
}
