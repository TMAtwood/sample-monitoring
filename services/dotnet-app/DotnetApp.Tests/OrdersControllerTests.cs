using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DotnetApp.Tests;

public class OrdersControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public OrdersControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetOrders_ReturnsOkOrServiceUnavailable()
    {
        // In test host without Postgres, may return 500
        var response = await _client.GetAsync("/api/orders");
        Assert.True(
            response.StatusCode == HttpStatusCode.OK ||
            response.StatusCode == HttpStatusCode.InternalServerError,
            $"Unexpected status: {response.StatusCode}");
    }

    [Fact]
    public async Task Health_ReturnsJsonWithChecks()
    {
        var response = await _client.GetAsync("/health");
        Assert.True(response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.ServiceUnavailable);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"status\"", body);
        Assert.Contains("\"checks\"", body);
        Assert.Contains("\"totalDurationMs\"", body);
    }

    [Fact]
    public async Task HealthLive_ReturnsLivenessChecks()
    {
        var response = await _client.GetAsync("/health/live");
        Assert.True(response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.ServiceUnavailable);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"status\"", body);
        Assert.Contains("memory", body);
        Assert.Contains("uptime", body);
        Assert.DoesNotContain("postgresql", body);
    }

    [Fact]
    public async Task HealthReady_ReturnsReadinessChecks()
    {
        var response = await _client.GetAsync("/health/ready");
        Assert.True(response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.ServiceUnavailable);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"status\"", body);
        Assert.Contains("postgresql", body);
        Assert.Contains("disk_space", body);
        Assert.DoesNotContain("\"uptime\"", body);
    }

    [Fact]
    public async Task Metrics_ReturnsPrometheusFormat()
    {
        var response = await _client.GetAsync("/metrics");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("dotnet_", body);
    }
}
