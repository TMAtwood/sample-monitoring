using Microsoft.AspNetCore.Mvc;
using Npgsql;
using DotnetApp.Models;

namespace DotnetApp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly NpgsqlDataSource _db;
    private readonly HttpClient _httpClient;

    public OrdersController(NpgsqlDataSource db, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClient = httpClientFactory.CreateClient("services");
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Order>>> GetOrders()
    {
        var orders = new List<Order>();
        await using var cmd = _db.CreateCommand("SELECT id, customer, product, quantity, total_cents, status, created_at, updated_at FROM orders ORDER BY id");
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            orders.Add(new Order(
                reader.GetInt32(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetInt32(3),
                reader.GetInt32(4),
                reader.GetString(5),
                reader.GetDateTime(6),
                reader.GetDateTime(7)));
        }
        return Ok(orders);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Order>> GetOrder(int id)
    {
        await using var cmd = _db.CreateCommand("SELECT id, customer, product, quantity, total_cents, status, created_at, updated_at FROM orders WHERE id = $1");
        cmd.Parameters.AddWithValue(id);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            return NotFound();

        return Ok(new Order(
            reader.GetInt32(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetInt32(3),
            reader.GetInt32(4),
            reader.GetString(5),
            reader.GetDateTime(6),
            reader.GetDateTime(7)));
    }

    /// <summary>
    /// Cross-service call: fetches items from the Spring Boot app.
    /// Creates a multi-hop trace: client → dotnet-app → spring-boot-app → postgres.
    /// </summary>
    [HttpGet("with-items")]
    public async Task<ActionResult> GetOrdersWithItems()
    {
        // Fetch orders from Postgres
        var orders = new List<Order>();
        await using var cmd = _db.CreateCommand("SELECT id, customer, product, quantity, total_cents, status, created_at, updated_at FROM orders ORDER BY id");
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            orders.Add(new Order(
                reader.GetInt32(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetInt32(3),
                reader.GetInt32(4),
                reader.GetString(5),
                reader.GetDateTime(6),
                reader.GetDateTime(7)));
        }

        // Cross-service call to Spring Boot app
        var itemsResponse = await _httpClient.GetAsync("http://spring-boot-app:8080/api/items");
        var items = await itemsResponse.Content.ReadFromJsonAsync<object>();

        return Ok(new { orders, items });
    }
}
