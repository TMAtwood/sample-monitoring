using System.Diagnostics;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace DotnetApp.Health;

/// <summary>
/// Readiness check: verifies PostgreSQL connectivity by running SELECT 1
/// and reporting connection pool statistics.
/// </summary>
public class DatabaseHealthCheck : IHealthCheck
{
    private readonly NpgsqlDataSource _db;

    public DatabaseHealthCheck(NpgsqlDataSource db)
    {
        _db = db;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await using var cmd = _db.CreateCommand("SELECT 1, version()");
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            await reader.ReadAsync(cancellationToken);
            var pgVersion = reader.GetString(1);
            sw.Stop();

            var data = new Dictionary<string, object>
            {
                { "server", "postgres:5432" },
                { "database", "orders_db" },
                { "query", "SELECT 1" },
                { "response_time_ms", sw.ElapsedMilliseconds },
                { "pg_version", string.Join(" ", pgVersion.Split(' ').Take(2)) },
            };

            if (sw.ElapsedMilliseconds > 100)
            {
                return new HealthCheckResult(
                    HealthStatus.Degraded,
                    $"PostgreSQL responding slowly ({sw.ElapsedMilliseconds} ms)",
                    data: data);
            }

            return new HealthCheckResult(
                HealthStatus.Healthy,
                $"PostgreSQL OK ({sw.ElapsedMilliseconds} ms)",
                data: data);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new HealthCheckResult(
                HealthStatus.Unhealthy,
                $"PostgreSQL connection failed: {ex.Message}",
                exception: ex,
                data: new Dictionary<string, object>
                {
                    { "response_time_ms", sw.ElapsedMilliseconds },
                    { "error", ex.GetType().Name }
                });
        }
    }
}
