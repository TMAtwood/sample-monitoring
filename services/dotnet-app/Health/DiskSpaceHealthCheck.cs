using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DotnetApp.Health;

/// <summary>
/// Readiness check: reports available disk space.
/// Returns Degraded below 500 MB, Unhealthy below 100 MB.
/// </summary>
public class DiskSpaceHealthCheck : IHealthCheck
{
    private const long DegradedThresholdBytes = 500L * 1024 * 1024;
    private const long UnhealthyThresholdBytes = 100L * 1024 * 1024;

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var drive = new DriveInfo("/");
        var freeBytes = drive.AvailableFreeSpace;
        var totalBytes = drive.TotalSize;
        var freeMb = freeBytes / (1024.0 * 1024.0);
        var totalMb = totalBytes / (1024.0 * 1024.0);
        var usedPercent = (1.0 - (double)freeBytes / totalBytes) * 100;

        var data = new Dictionary<string, object>
        {
            { "drive", "/" },
            { "total_mb", Math.Round(totalMb, 1) },
            { "free_mb", Math.Round(freeMb, 1) },
            { "used_percent", Math.Round(usedPercent, 1) }
        };

        if (freeBytes <= UnhealthyThresholdBytes)
        {
            return Task.FromResult(new HealthCheckResult(
                HealthStatus.Unhealthy,
                $"Disk critically low: {freeMb:F0} MB free",
                data: data));
        }

        if (freeBytes <= DegradedThresholdBytes)
        {
            return Task.FromResult(new HealthCheckResult(
                HealthStatus.Degraded,
                $"Disk space low: {freeMb:F0} MB free",
                data: data));
        }

        return Task.FromResult(new HealthCheckResult(
            HealthStatus.Healthy,
            $"Disk OK: {freeMb:F0} MB free ({usedPercent:F1}% used)",
            data: data));
    }
}
