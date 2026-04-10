using System.Diagnostics;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DotnetApp.Health;

/// <summary>
/// Liveness check: reports process memory usage.
/// Returns Degraded above 150 MB, Unhealthy above 300 MB.
/// </summary>
public class MemoryHealthCheck : IHealthCheck
{
    private const long DegradedThresholdBytes = 150 * 1024 * 1024;
    private const long UnhealthyThresholdBytes = 300 * 1024 * 1024;

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var process = Process.GetCurrentProcess();
        var allocatedBytes = process.WorkingSet64;
        var allocatedMb = allocatedBytes / (1024.0 * 1024.0);

        var data = new Dictionary<string, object>
        {
            { "allocated_mb", Math.Round(allocatedMb, 2) },
            { "threshold_degraded_mb", DegradedThresholdBytes / (1024.0 * 1024.0) },
            { "threshold_unhealthy_mb", UnhealthyThresholdBytes / (1024.0 * 1024.0) },
            { "gen0_collections", GC.CollectionCount(0) },
            { "gen1_collections", GC.CollectionCount(1) },
            { "gen2_collections", GC.CollectionCount(2) }
        };

        if (allocatedBytes >= UnhealthyThresholdBytes)
        {
            return Task.FromResult(new HealthCheckResult(
                HealthStatus.Unhealthy,
                $"Memory critically high: {allocatedMb:F1} MB",
                data: data));
        }

        if (allocatedBytes >= DegradedThresholdBytes)
        {
            return Task.FromResult(new HealthCheckResult(
                HealthStatus.Degraded,
                $"Memory elevated: {allocatedMb:F1} MB",
                data: data));
        }

        return Task.FromResult(new HealthCheckResult(
            HealthStatus.Healthy,
            $"Memory OK: {allocatedMb:F1} MB",
            data: data));
    }
}
