const test = require("node:test");
const assert = require("node:assert/strict");
const { createCJClient } = require("./cj-catalog");

test("CJ client authenticates server-side and normalizes product search results", async () => {
  const calls = [];
  const client = createCJClient({
    apiKey: "server-only-api-key",
    now: () => Date.parse("2026-11-08T00:00:00Z"),
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("getAccessToken")) {
        return Response.json({
          code: 200,
          data: {
            accessToken: "server-access-token",
            accessTokenExpiryDate: "2027-01-01T00:00:00Z",
          },
        });
      }
      return Response.json({
        code: 200,
        data: {
          content: [{
            productList: [{
              id: "cj-product-1",
              nameEn: "Compact desk organizer",
              sku: "CJ-ORG-1",
              bigImage: "https://images.example/organizer.jpg",
              sellPrice: "5.20",
              warehouseInventoryNum: 28,
            }],
          }],
        },
      });
    },
  });

  const products = await client.searchProducts("desk organizer");
  assert.deepEqual(products[0], {
    id: "cj-product-1",
    name: "Compact desk organizer",
    sku: "CJ-ORG-1",
    image: "https://images.example/organizer.jpg",
    cost: 5.2,
    category: "",
    inventory: 28,
  });
  assert.equal(client.getCachedProduct("cj-product-1").cost, 5.2);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.body, JSON.stringify({ apiKey: "server-only-api-key" }));
  assert.equal(calls[1].options.headers["CJ-Access-Token"], "server-access-token");
});

test("CJ client rejects missing credentials and malformed search terms", async () => {
  const client = createCJClient({ apiKey: "" });
  await assert.rejects(() => client.searchProducts("desk"), /CJ_API_KEY/);
  await assert.rejects(() => client.searchProducts("x"), /search term/);
});

test("CJ client returns variant IDs and stock for the admin import workflow", async () => {
  const client = createCJClient({
    apiKey: "api-key",
    fetchImpl: async (url) => {
      if (String(url).includes("getAccessToken")) {
        return Response.json({
          code: 200,
          data: { accessToken: "access-token", accessTokenExpiryDate: "2027-01-01T00:00:00Z" },
        });
      }
      return Response.json({
        code: 200,
        data: {
          variants: [{
            vid: "variant-1",
            variantSku: "CJ-ITEM-BLACK",
            variantNameEn: "Black",
            variantSellPrice: "6.75",
            inventories: [
              { countryCode: "CN", totalInventory: 15 },
              { countryCode: "US", totalInventory: 3 },
            ],
          }],
        },
      });
    },
  });

  const variants = await client.getProductVariants("product-1");
  assert.deepEqual(variants, [{
    id: "variant-1",
    sku: "CJ-ITEM-BLACK",
    name: "Black",
    cost: 6.75,
    inventory: 18,
  }]);
  assert.equal(client.getCachedVariant("product-1", "variant-1").inventory, 18);
});
