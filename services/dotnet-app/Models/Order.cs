namespace DotnetApp.Models;

public record Order(int Id, string Customer, string Product, int Quantity, int TotalCents, string Status, DateTime CreatedAt, DateTime UpdatedAt);
