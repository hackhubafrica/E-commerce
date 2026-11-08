const CJ_API = "https://developers.cjdropshipping.com/api2.0/v1";

function createCJClient({ apiKey, fetchImpl = fetch, now = Date.now }) {
  let token = "";
  let expiresAt = 0;
  const cachedProducts = new Map();
  const cachedVariants = new Map();

  async function getAccessToken() {
    if (token && expiresAt - now() > 5 * 60 * 1000) return token;
    if (!apiKey) throw new Error("CJ_API_KEY is not configured.");

    const response = await fetchImpl(`${CJ_API}/authentication/getAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || Number(result.code) !== 200 || !result.data?.accessToken) {
      throw new Error("CJ authentication failed. Check the API key in the backend environment.");
    }

    token = result.data.accessToken;
    const expiry = Date.parse(result.data.accessTokenExpiryDate);
    expiresAt = Number.isFinite(expiry) ? expiry : now() + 60 * 60 * 1000;
    return token;
  }

  async function searchProducts(keyword) {
    const searchTerm = String(keyword || "").trim();
    if (searchTerm.length < 2 || searchTerm.length > 100) {
      throw new Error("Enter a supplier search term between 2 and 100 characters.");
    }
    const accessToken = await getAccessToken();
    const params = new URLSearchParams({
      keyWord: searchTerm,
      page: "1",
      size: "20",
      features: "enable_category",
    });
    const response = await fetchImpl(`${CJ_API}/product/listV2?${params}`, {
      headers: { "CJ-Access-Token": accessToken },
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || (result.code !== undefined && ![0, 200].includes(Number(result.code)))) {
      throw new Error("CJ product search failed. Try again later.");
    }

    const groups = Array.isArray(result.data?.content) ? result.data.content : [];
    const products = groups.flatMap((group) => group.productList || [])
      .filter((product) => product?.id && product?.nameEn && product?.bigImage)
      .map((product) => ({
        id: String(product.id),
        name: String(product.nameEn).slice(0, 160),
        sku: String(product.sku || product.spu || "").slice(0, 100),
        image: String(product.bigImage),
        cost: Number(product.discountPrice || product.nowPrice || product.sellPrice),
        category: String(product.threeCategoryName || product.twoCategoryName || ""),
        inventory: Number(product.warehouseInventoryNum || 0),
      }))
      .filter((product) => /^https:\/\//i.test(product.image)
        && Number.isFinite(product.cost) && product.cost > 0);
    for (const product of products) {
      cachedProducts.set(product.id, { product, expiresAt: now() + 10 * 60 * 1000 });
    }
    return products;
  }

  async function getProductVariants(productId, countryCode = "") {
    const id = String(productId || "").trim();
    if (!id || id.length > 200) throw new Error("Choose a valid CJ product.");
    const accessToken = await getAccessToken();
    const country = String(countryCode || "").trim().toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) throw new Error("Choose a valid destination country.");
    const params = new URLSearchParams({ pid: id });
    if (country) params.set("countryCode", country);
    const response = await fetchImpl(`${CJ_API}/product/query?${params}`, {
      headers: { "CJ-Access-Token": accessToken },
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || (result.code !== undefined && ![0, 200].includes(Number(result.code)))) {
      throw new Error("CJ product variants could not be loaded.");
    }

    const variants = (result.data?.variants || [])
      .filter((variant) => variant?.vid && variant?.variantSku)
      .map((variant) => ({
        id: String(variant.vid),
        sku: String(variant.variantSku).slice(0, 100),
        name: String(variant.variantNameEn || variant.variantSku).slice(0, 160),
        cost: Number(variant.variantSellPrice),
        inventory: (variant.inventories || []).reduce(
          (sum, inventory) => sum + Math.max(0, Number(inventory.totalInventory) || 0),
          0,
        ),
      }))
      .filter((variant) => Number.isFinite(variant.cost) && variant.cost > 0);
    for (const variant of variants) {
      cachedVariants.set(`${id}:${country}:${variant.id}`, {
        variant,
        expiresAt: now() + 10 * 60 * 1000,
      });
    }
    return variants;
  }

  function getCachedProduct(productId) {
    const cached = cachedProducts.get(String(productId));
    if (!cached || cached.expiresAt <= now()) {
      cachedProducts.delete(String(productId));
      return null;
    }
    return cached.product;
  }

  function getCachedVariant(productId, variantId, countryCode = "") {
    const key = `${String(productId)}:${String(countryCode || "").toUpperCase()}:${String(variantId)}`;
    const cached = cachedVariants.get(key);
    if (!cached || cached.expiresAt <= now()) {
      cachedVariants.delete(key);
      return null;
    }
    return cached.variant;
  }

  return { searchProducts, getCachedProduct, getProductVariants, getCachedVariant };
}

module.exports = { createCJClient };
