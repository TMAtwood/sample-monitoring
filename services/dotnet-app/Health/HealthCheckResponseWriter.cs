using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DotnetApp.Health;

public static class HealthCheckResponseWriter
{
    public static Task WriteResponse(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";

        var options = new JsonWriterOptions { Indented = true };
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, options))
        {
            writer.WriteStartObject();

            writer.WriteString("status", report.Status.ToString());
            writer.WriteString("totalDuration", FormatDuration(report.TotalDuration));
            writer.WriteNumber("totalDurationMs",
                Math.Round(report.TotalDuration.TotalMilliseconds, 2));

            writer.WriteStartArray("checks");

            foreach (var entry in report.Entries)
            {
                writer.WriteStartObject();
                writer.WriteString("name", entry.Key);
                writer.WriteString("status", entry.Value.Status.ToString());
                writer.WriteString("duration", FormatDuration(entry.Value.Duration));
                writer.WriteNumber("durationMs",
                    Math.Round(entry.Value.Duration.TotalMilliseconds, 2));

                if (entry.Value.Description is not null)
                    writer.WriteString("description", entry.Value.Description);

                if (entry.Value.Exception is not null)
                    writer.WriteString("exception", entry.Value.Exception.Message);

                if (entry.Value.Data.Count > 0)
                {
                    writer.WriteStartObject("data");
                    foreach (var item in entry.Value.Data)
                    {
                        writer.WritePropertyName(item.Key);
                        JsonSerializer.Serialize(writer, item.Value,
                            item.Value?.GetType() ?? typeof(object));
                    }
                    writer.WriteEndObject();
                }

                writer.WriteEndObject();
            }

            writer.WriteEndArray();
            writer.WriteEndObject();
        }

        return context.Response.WriteAsync(
            Encoding.UTF8.GetString(stream.ToArray()));
    }

    private static string FormatDuration(TimeSpan ts) =>
        ts.TotalSeconds >= 1
            ? $"{ts.TotalSeconds:F3}s"
            : $"{ts.TotalMilliseconds:F2}ms";
}
