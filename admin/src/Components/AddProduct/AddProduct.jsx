import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './AddProduct.css'
import upload_area from '../../assets/upload_area.svg'
import { adminRequest } from '../../api';

const emptyProduct = {
    name: "",
    category: "women",
    new_price: "",
    old_price: "",
};

const AddProduct = ({ token }) => {
    const [image, setImage] = useState(null);
    const [productDetails, setProductDetails] = useState(emptyProduct);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const formRef = useRef(null);
    const [cjKeyword, setCjKeyword] = useState("");
    const [cjProducts, setCjProducts] = useState([]);
    const [cjCategory, setCjCategory] = useState("office");
    const [cjPrices, setCjPrices] = useState({});
    const [cjVariants, setCjVariants] = useState({});
    const [cjSelectedVariants, setCjSelectedVariants] = useState({});
    const [loadingVariants, setLoadingVariants] = useState("");
    const [cjError, setCjError] = useState("");
    const [isSearchingCJ, setIsSearchingCJ] = useState(false);

    const searchCJ = async (event) => {
        event.preventDefault();
        setIsSearchingCJ(true);
        setCjError("");
        try {
            const query = new URLSearchParams({ q: cjKeyword.trim() });
            const result = await adminRequest(`/admin/cj/products?${query}`, token);
            setCjProducts(result.products);
            setCjVariants({});
            setCjSelectedVariants({});
            if (!result.products.length) setCjError("No matching CJ products were found.");
        } catch (requestError) {
            setCjError(requestError instanceof Error ? requestError.message : "CJ search failed.");
        } finally {
            setIsSearchingCJ(false);
        }
    };

    const loadVariants = async (product) => {
        setLoadingVariants(product.id);
        setCjError("");
        try {
            const result = await adminRequest(
                `/admin/cj/products/${encodeURIComponent(product.id)}/variants`,
                token,
            );
            setCjVariants((current) => ({ ...current, [product.id]: result.variants }));
            if (!result.variants.length) setCjError("CJ returned no purchasable variants for this product.");
        } catch (requestError) {
            setCjError(requestError instanceof Error ? requestError.message : "Unable to load CJ variants.");
        } finally {
            setLoadingVariants("");
        }
    };

    const importCJProduct = async (product) => {
        const newPrice = Number(cjPrices[product.id]);
        if (!Number.isFinite(newPrice) || newPrice <= 0) {
            setCjError("Enter the customer-facing price before importing this product.");
            return;
        }
        const supplierVariantId = cjSelectedVariants[product.id];
        if (!supplierVariantId) {
            setCjError("Choose a supplier variant before importing this product.");
            return;
        }
        setCjError("");
        try {
            await adminRequest("/admin/cj/import", token, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    supplierProductId: product.id,
                    supplierVariantId,
                    new_price: newPrice,
                    category: cjCategory,
                }),
            });
            setCjProducts((current) => current.filter((item) => item.id !== product.id));
            setMessage(`${product.name} was added to your store. Review shipping and variant details before selling.`);
        } catch (requestError) {
            setCjError(requestError instanceof Error ? requestError.message : "Unable to import this product.");
        }
    };

    const changeHandler = (event) => {
        setProductDetails((current) => ({ ...current, [event.target.name]: event.target.value }));
    };

    const addProduct = async (event) => {
        event.preventDefault();
        if (!image) {
            setError("Choose a product image.");
            return;
        }
        setIsSubmitting(true);
        setError("");
        setMessage("");
        try {
            const formData = new FormData();
            formData.append("product", image);
            const uploadData = await adminRequest("/upload", token, { method: "POST", body: formData });
            await adminRequest("/addproduct", token, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...productDetails, image: uploadData.image_url }),
            });
            setProductDetails(emptyProduct);
            setImage(null);
            formRef.current?.reset();
            setMessage("Product saved. It will appear in the storefront when the catalog refreshes.");
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to add this product.");
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="add-product-page">
        <section className="cj-importer" aria-labelledby="cj-import-heading">
            <h2 id="cj-import-heading">Find products from CJ</h2>
            <p>Search supplier products. Your CJ credentials stay on the backend; set the retail price yourself.</p>
            <form className="cj-search" onSubmit={searchCJ}>
                <label className="sr-only" htmlFor="cj-search-term">Search CJ products</label>
                <input
                    id="cj-search-term"
                    value={cjKeyword}
                    onChange={(event) => setCjKeyword(event.target.value)}
                    minLength={2}
                    maxLength={100}
                    placeholder="Try desk organizer or cable clips"
                    required
                />
                <button type="submit" disabled={isSearchingCJ}>{isSearchingCJ ? "Searching..." : "Search CJ"}</button>
            </form>
            <label htmlFor="cj-category">Store category</label>
            <select id="cj-category" value={cjCategory} onChange={(event) => setCjCategory(event.target.value)}>
                <option value="office">Office & desk</option>
                <option value="home">Home</option>
                <option value="pets">Pets</option>
                <option value="beauty">Beauty</option>
                <option value="travel">Travel</option>
                <option value="fitness">Fitness</option>
            </select>
            {cjError && <p className="admin-form-error" role="alert">{cjError}</p>}
            {!!cjProducts.length && (
                <div className="cj-results">
                    {cjProducts.map((product) => (
                        <article className="cj-result" key={product.id}>
                            <img src={product.image} alt="" loading="lazy" />
                            <div>
                                <h3>{product.name}</h3>
                                <p>Supplier cost: ${product.cost.toFixed(2)} · Available inventory shown by supplier: {product.inventory}</p>
                                {!cjVariants[product.id] && (
                                    <button
                                        type="button"
                                        onClick={() => loadVariants(product)}
                                        disabled={loadingVariants === product.id}
                                    >
                                        {loadingVariants === product.id ? "Loading variants..." : "Load variants"}
                                    </button>
                                )}
                                {!!cjVariants[product.id]?.length && (
                                    <>
                                        <label htmlFor={`cj-variant-${product.id}`}>Supplier variant</label>
                                        <select
                                            id={`cj-variant-${product.id}`}
                                            value={cjSelectedVariants[product.id] || ""}
                                            onChange={(event) => {
                                                const variant = cjVariants[product.id].find((item) => item.id === event.target.value);
                                                setCjSelectedVariants((current) => ({ ...current, [product.id]: event.target.value }));
                                                if (variant) setCjPrices((current) => ({ ...current, [product.id]: current[product.id] || "" }));
                                            }}
                                        >
                                            <option value="">Choose a variant</option>
                                            {cjVariants[product.id].map((variant) => (
                                                <option key={variant.id} value={variant.id} disabled={variant.inventory < 1}>
                                                    {variant.name} · cost ${variant.cost.toFixed(2)} · stock {variant.inventory}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                )}
                                <label htmlFor={`cj-price-${product.id}`}>Your retail price (USD)</label>
                                <input
                                    id={`cj-price-${product.id}`}
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={cjPrices[product.id] || ""}
                                    onChange={(event) => setCjPrices((current) => ({ ...current, [product.id]: event.target.value }))}
                                    required
                                />
                                <button type="button" onClick={() => importCJProduct(product)}>Add to store</button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
        <form className="add-product" onSubmit={addProduct} ref={formRef}>
            <div className="addproduct-itemfield">
                <label htmlFor="product-name">Product title</label>
                <input id="product-name" value={productDetails.name} onChange={changeHandler} type="text" name="name" maxLength={160} placeholder="Type here" required />
            </div>

            <div className="add-product-price">
                <div className="addproduct-itemfield">
                    <label htmlFor="old-price">Original price</label>
                    <input id="old-price" value={productDetails.old_price} onChange={changeHandler} type="number" name="old_price" min="0.01" step="0.01" placeholder="Type here" required />
                </div>
                <div className="addproduct-itemfield">
                    <label htmlFor="new-price">Sale price</label>
                    <input id="new-price" value={productDetails.new_price} onChange={changeHandler} type="number" name="new_price" min="0.01" step="0.01" placeholder="Type here" required />
                </div>
            </div>
            <div className="addproduct-itemfield">
                    <label htmlFor="product-category">Product category</label>
                    <select id="product-category" value={productDetails.category} onChange={changeHandler} name="category" className="add-product-selector">
                        <option value="women">Women</option>
                        <option value="men">Men</option>
                        <option value="kid">Kids</option>
                        <option value="office">Office & desk</option>
                        <option value="home">Home</option>
                        <option value="pets">Pets</option>
                        <option value="beauty">Beauty</option>
                        <option value="travel">Travel</option>
                        <option value="fitness">Fitness</option>
                    </select>
            </div>

            <div className="addproduct-itemfield">
                <label htmlFor="file-input">Product image
                    <img src={image ? URL.createObjectURL(image) : upload_area} className="addproduct-thumbnail-img" alt={image ? image.name : "Choose an image"} />
                </label>
                <input onChange={(event) => setImage(event.target.files?.[0] || null)} type="file" name="image" id="file-input" accept="image/jpeg,image/png,image/webp,image/gif" required />
            </div>
            {error && <p className="admin-form-error" role="alert">{error}</p>}
            {message && <p className="admin-form-success" role="status">{message}</p>}
            <button type="submit" className="addproduct-btn" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Add product"}</button>
        </form>
        </div>
    )
}

export default AddProduct;

AddProduct.propTypes = {
    token: PropTypes.string.isRequired,
};